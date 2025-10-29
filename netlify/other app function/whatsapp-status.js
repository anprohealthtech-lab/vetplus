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

// netlify/functions/whatsapp-status.ts
var whatsapp_status_exports = {};
__export(whatsapp_status_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(whatsapp_status_exports);
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
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }
  try {
    console.log("Checking WhatsApp status...");
    const statusUrl = `${WHATSAPP_API_BASE_URL}/api/whatsapp/status`;
    const generalStatusUrl = `${WHATSAPP_API_BASE_URL}/api/status`;
    const [whatsappResponse, generalResponse] = await Promise.all([
      fetch(statusUrl).catch(() => null),
      fetch(generalStatusUrl).catch(() => null)
    ]);
    let whatsappStatus = null;
    let generalStatus = null;
    if (whatsappResponse?.ok) {
      whatsappStatus = await whatsappResponse.json();
    }
    if (generalResponse?.ok) {
      generalStatus = await generalResponse.json();
    }
    console.log("WhatsApp Status:", whatsappStatus);
    console.log("General Status:", generalStatus);
    const isConnected = generalStatus?.data?.whatsapp?.isConnected || whatsappStatus?.data?.isConnected || false;
    const isAuthenticated = generalStatus?.data?.whatsapp?.isAuthenticated || whatsappStatus?.data?.isAuthenticated || false;
    const lastSeen = generalStatus?.data?.whatsapp?.lastSeen || whatsappStatus?.data?.lastSeen || null;
    const result = {
      isConnected,
      isAuthenticated,
      lastSeen,
      needsQR: !isConnected || !isAuthenticated,
      sessionActive: isConnected && isAuthenticated,
      rawResponses: {
        whatsappStatus,
        generalStatus
      }
    };
    console.log("Final status result:", result);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: result
      })
    };
  } catch (error) {
    console.error("WhatsApp status check error:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        needsQR: true
        // Default to needing QR on error
      })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
