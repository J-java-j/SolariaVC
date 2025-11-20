
import { MarketData } from "../types";

/**
 * SERVICE CONFIGURATION
 * 
 * 1. Open your Terminal on the website (Hold to Decrypt -> type 'deploy').
 * 2. Copy the Google Apps Script code.
 * 3. Deploy it as a Web App (Execute as: Me, Access: Anyone).
 * 4. Paste the URL below.
 */

// PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL HERE:
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw9pGNIeB6EfvUMnlWKmqALdGYHBVrFoSf7iKDgyEH3Fc-70rtCA4oU7kRwIqnysxja/exec"; 

export const submitEmail = async (email: string): Promise<{ success: boolean; message: string }> => {
  
  // Check if user forgot to update the URL
  if (SCRIPT_URL.includes("YOUR_DEPLOYED_URL_HERE") || SCRIPT_URL.includes("AKfycbxx1zGl7_xt_zXeqWEWnDtfi5hXN5UVf1-nFRaUwQHBQCt44DplNsWXptJuC6AGBC0g")) {
      // Allow the placeholder for demo purposes, but warn in console
      console.warn("Using demo/placeholder script URL. Data may not be saved.");
  }

  try {
    // We use URLSearchParams for x-www-form-urlencoded data which is easiest for GAS to parse
    const params = new URLSearchParams();
    params.append('email', email);
    params.append('timestamp', new Date().toISOString());

    await fetch(SCRIPT_URL, {
      method: 'POST',
      body: params,
      // 'no-cors' is REQUIRED for Google Apps Script Web Apps to work from a browser
      // This means we won't get a readable JSON response, but the request will succeed.
      mode: 'no-cors', 
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    return { success: true, message: "UPLINK_ESTABLISHED_DATA_SECURE" };

  } catch (error) {
    console.error("Submission Error:", error);
    return { success: false, message: "CONNECTION_FAILED_RETRY" };
  }
};

// --- BACKEND CODE FOR GOOGLE APPS SCRIPT ---
export const BACKEND_CODE = `
/* 
   === SOLARIA BACKEND SCRIPT ===
   
   INSTRUCTIONS:
   1. Paste this into Extensions > Apps Script.
   2. UPDATE the 'CUSTOM_FROM' variable below if needed.
   3. Run the function 'SETUP_PERMISSIONS' once to grant access.
   4. Deploy > New Deployment > Web App > Anyone.
*/

var CUSTOM_FROM = "contact@solariavc.com"; // <--- UPDATED ALIAS

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var email = (e && e.parameter && e.parameter.email) ? e.parameter.email : "unknown";
    var timestamp = new Date();

    // 1. Save to Database
    sheet.appendRow([timestamp, email]);
    
    // 2. Send Email (Using Alias)
    try {
      GmailApp.sendEmail(email, "STATUS: PRIORITY ACCESS CONFIRMED", "", {
        from: CUSTOM_FROM,
        htmlBody: \`
        <div style="background-color: #000000; color: #00ff41; font-family: 'Courier New', monospace; padding: 40px; border: 1px solid #00ff41;">
          <h1 style="margin-top: 0; letter-spacing: 2px; font-size: 24px; border-bottom: 1px solid #333; padding-bottom: 20px;">> ACCESS_LEVEL: ELITE</h1>
          
          <p style="font-size: 14px; line-height: 1.6; color: #cccccc;">
            Identity Verified: <span style="color: #fff;">\${email}</span><br>
            Status: <span style="color: #00ff41;">CONFIRMED</span>
          </p>

          <p style="margin-top: 30px; font-size: 16px; color: #fff;">
            Congratulations. You made the cut.
          </p>

          <p style="font-size: 14px; line-height: 1.6; color: #cccccc;">
            Our algorithms have flagged your signal as <strong>Top 1% Priority</strong>. 
            While others wait in the queue, you have secured direct access to the Solaria ecosystem.
          </p>

          <p style="font-size: 14px; line-height: 1.6; color: #cccccc;">
            We are building the infrastructure for the decentralized future. You will be the first to know when we go live.
          </p>

          <p style="margin-top: 40px; font-size: 12px; color: #666;">
            // AWAIT FURTHER INSTRUCTIONS<br>
            // SOLARIA_HQ_SAN_DIEGO
          </p>
        </div>
        \`,
        name: "Solaria VC"
      });
    } catch (emailError) {
      // Fallback if alias fails (sends from default gmail)
      GmailApp.sendEmail(email, "STATUS: PRIORITY ACCESS CONFIRMED", "You have been added to the priority list.");
    }

    return ContentService.createTextOutput(JSON.stringify({ result: "success" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({ result: "error", error: e.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// !!! RUN THIS FUNCTION ONCE IN THE EDITOR TO FIX PERMISSIONS !!!
function SETUP_PERMISSIONS() {
  console.log("Requesting permissions...");
  var aliases = GmailApp.getAliases();
  console.log("Aliases found: " + aliases);
  SpreadsheetApp.getActiveSpreadsheet();
  console.log("Permissions granted! You can now Deploy.");
}
`;
