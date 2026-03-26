var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// netlify/functions/whatsapp-qr.ts
var whatsapp_qr_exports = {};
__export(whatsapp_qr_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(whatsapp_qr_exports);
var WHATSAPP_API_BASE_URL = "https://lionfish-app-nmodi.ondigitalocean.app";
var handler = async (event, context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  };
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ""
    };
  }
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }
  try {
    console.log("Starting WhatsApp QR generation...");
    const generateResponse = await fetch(`${WHATSAPP_API_BASE_URL}/api/generate-qr`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    });
    let generateResult = null;
    if (generateResponse.ok) {
      generateResult = await generateResponse.json();
      console.log("QR generation response:", generateResult);
    }
    const statusResponse = await fetch(`${WHATSAPP_API_BASE_URL}/api/whatsapp/status`);
    let statusResult = null;
    if (statusResponse.ok) {
      statusResult = await statusResponse.json();
      console.log("Status after QR gen:", statusResult);
    }
    const qrResponse = await fetch(`${WHATSAPP_API_BASE_URL}/api/qr`).catch(() => null);
    let qrData = null;
    if (qrResponse?.ok) {
      qrData = await qrResponse.text();
      console.log("QR data found:", qrData ? "Yes" : "No");
    }
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: "QR code generation initiated",
        data: {
          generateResult,
          statusResult,
          qrData,
          instructions: [
            "QR code has been generated on the WhatsApp backend server",
            "Check the server console/logs for the QR code display",
            "Scan the QR code with WhatsApp on your phone",
            "Go to WhatsApp \u2192 Settings \u2192 Linked Devices \u2192 Link a Device"
          ],
          backendUrl: WHATSAPP_API_BASE_URL,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }
      })
    };
  } catch (error) {
    console.error("QR generation error:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        message: "Failed to generate QR code"
      })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
