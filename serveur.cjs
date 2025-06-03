const OpenAI = require("openai");
const openai = new OpenAI();
const WebSocket = require("ws");
const express = require("express");
const twilio = require("twilio");
const speech = require("@google-cloud/speech");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(express.urlencoded({ extended: true }));

const server = require("http").createServer(app);
const wss = new WebSocket.Server({ server });

// 🔥 Google Cloud Auth
process.env.GOOGLE_APPLICATION_CREDENTIALS = "";
const client = new speech.SpeechClient();

// 🔥 Twilio Auth
const TWILIO_ACCOUNT_SID = "";
const TWILIO_AUTH_TOKEN = "";
const TWILIO_PHONE_NUMBER = "";
const clientTwilio = new twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

client.getProjectId().then((id) => console.log(`✅ Google Cloud Authenticated: Project ID = ${id}`));

const request = {
  config: {
    encoding: "MULAW",
    sampleRateHertz: 8000,
    languageCode: "fr-FR",
  },
  interimResults: true,
};

wss.on("connection", (ws) => {
  console.log("🔵 New WebSocket Connection Established");

  let recognizeStream = null;
  let streamActive = false;
  let alertSent = false;

  ws.on("message", async (message) => {
    try {
      const msg = JSON.parse(message);

      switch (msg.event) {
        case "connected":
          console.log("✅ Call connected.");
          alertSent = false; // Réinitialisation à chaque nouvel appel
          break;

        case "start":
          console.log(`🚀 Starting Stream: ${msg.streamSid}`);

          if (!recognizeStream) {
            recognizeStream = client
              .streamingRecognize(request)
              .on("error", (err) => {
                console.error("❌ Speech-to-Text Error:", err);
                stopStream();
              })
              .on("data", async (data) => {
                if (!streamActive || alertSent) return; // Si une alerte a déjà été envoyée, on ne scanne plus

                const transcript = data.results[0]?.alternatives[0]?.transcript;
                if (transcript) {
                  console.log(`📝 Transcription: ${transcript}`);

                  if (transcript.toLowerCase().includes("banque")) {
                    console.log("⚠️ Possible fraud detected: 'banque' keyword found.");

                    // 🔍 Envoyer la transcription à l'IA pour analyse
                    try {
                      const completion = await openai.chat.completions.create({
                        model: "gpt-4o-mini",
                        messages: [
                          { role: "system", content: `Analyze the provided transcript of a phone conversation in French to determine if there are indications that the person is attempting to commit a scam.\n\nIdentify common scam indicators or phrases that could suggest fraudulent intent. Provide a response of \`Y\` if the transcript contains elements that suggest a scam is likely occurring, otherwise, provide a response of \`N\`.\n\n# Output Format\n\n- A single character: \`Y\` if a scam is indicated, \`N\` if no scam is present.\n\n# Notes\n\n- Consider patterns such as requests for sensitive information, offers that seem too good to be true, urgent demands, or any manipulation tactics common in scam scenarios.\n- Your determination should focus on the presence or absence of these indicators rather than making a subjective judgment of the overall conversation quality.` },
                          { role: "user", content: transcript }
                        ],
                      });

                      const aiResponse = completion.choices[0]?.message?.content?.trim();
                      console.log(`🤖 AI Response: ${aiResponse}`);

                      if (aiResponse === "Y") {
                        alertSent = true; // Bloquer les prochaines analyses
                        triggerFraudAlert(`Conf-${msg.streamSid}`);
                      }
                    } catch (err) {
                      console.error("❌ Error with AI analysis:", err);
                    }
                  }
                }
              });

            streamActive = true;
            console.log("🎤 Recognize Stream Active");
          }
          break;

        case "media":
          if (streamActive && recognizeStream) {
            recognizeStream.write(msg.media.payload);
          }
          break;

        case "stop":
          console.log("🛑 Call Ended. Stopping Stream...");
          stopStream();
          break;
      }
    } catch (err) {
      console.error("❌ Error processing message:", err);
    }
  });

  ws.on("close", () => {
    console.log("🔴 WebSocket Connection Closed");
    stopStream();
  });

  function stopStream() {
    if (recognizeStream) {
      recognizeStream.destroy();
      recognizeStream = null;
      streamActive = false;
      console.log("✅ Recognize Stream Stopped");
    }
  }

  function triggerFraudAlert(conferenceId) {
    console.log("🎵 Triggering Fraud Alert...");

    const fraudMessage = "Attention, please verify the identity of the person.";

    // Send SMS alert
    clientTwilio.messages
      .create({
        body: "⚠️ Alerte Éthiq : Un élément suspect a été détecté dans cet appel. Restez prudent et évitez de partager des informations sensibles.",
        from: TWILIO_PHONE_NUMBER,
        to: "",
      })
      .then((message) => console.log(`📩 SMS Alert Sent: ${message.sid}`))
      .catch((err) => console.error("❌ Failed to send SMS alert:", err));

    // Trigger fraud message in active conference
    clientTwilio.conferences.list({ status: "in-progress", limit: 5 })
      .then((conferences) => {
        if (conferences.length === 0) {
          console.error("❌ No active conferences found.");
          return;
        }

        const activeConference = conferences[0]; // Get the first active conference
        console.log("📢 Found active conference:", activeConference.friendlyName, "SID:", activeConference.sid);

        clientTwilio.conferences(activeConference.sid)
          .update({
            announceUrl: `http://twimlets.com/message?Message=${encodeURIComponent(fraudMessage)}&Voice=female&Language=fr-FR`
          })
          .then((conference) => {
            console.log("🎧 Fraud announcement triggered in conference:", conference.sid);
          })
          .catch((err) => {
            console.error("❌ Error triggering fraud announcement:", err);
          });
      })
      .catch((err) => {
        console.error("❌ Error fetching active conferences:", err);
      });
  }
});

app.use(express.static("public"));

app.post("/", async (req, res) => {
  res.set("Content-Type", "text/xml");

  try {
    const calls = await clientTwilio.calls.list({ to: TWILIO_PHONE_NUMBER, limit: 1 });
    const lastIncomingCall = calls.length > 0 ? calls[0] : null;
    
    const callerNumber = lastIncomingCall ? lastIncomingCall.from : "UnknownCaller";
    console.log(`📞 Real caller: ${callerNumber}`);

    const conferenceName = `Conf-${callerNumber}`;

    res.send(`
      <Response>
        <Start>
          <Stream url="wss://${req.headers.host}/"/>
        </Start>
        <Dial>
          <Conference startConferenceOnEnter="true" endConferenceOnExit="true">${conferenceName}</Conference>
        </Dial>
      </Response>
    `);

    setTimeout(() => {
      addSipToConference(conferenceName, callerNumber);
    }, 2000);
  } catch (error) {
    console.error("❌ Error handling call:", error);
    res.send("<Response><Reject/></Response>");
  }
});

function addSipToConference(conferenceName, callerNumber) {
  console.log("📞 Adding SIP user to conference:", conferenceName);

  clientTwilio.calls
    .create({
      to: "adresseSIPduReceveur",
      from: TWILIO_PHONE_NUMBER, 
      callerId: callerNumber,
      twiml: `<Response><Dial><Conference>${conferenceName}</Conference></Dial></Response>`
    })
    .then((call) => {
      console.log(`📞 SIP User added to conference (${conferenceName}):`, call.sid);
    })
    .catch((err) => {
      console.error("❌ Failed to add SIP user:", err);
    });
}

console.log("🎧 Listening on Port 8080...");
server.listen(8080);
