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

// netlify/functions/whatsapp-proxy.ts
var whatsapp_proxy_exports = {};
__export(whatsapp_proxy_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(whatsapp_proxy_exports);
var WHATSAPP_API_BASE_URL = "https://lionfish-app-nmodi.ondigitalocean.app";
var handler = async (event, context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
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
    const { endpoint, method, body } = JSON.parse(event.body || "{}");
    if (!endpoint) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Endpoint is required" })
      };
    }
    const url = `${WHATSAPP_API_BASE_URL}${endpoint}`;
    const config = {
      method,
      headers: {
        "Content-Type": "application/json"
      }
    };
    if (body && (method === "POST" || method === "PUT")) {
      config.body = JSON.stringify(body);
    }
    console.log(`Proxying ${method} request to: ${url}`);
    const response = await fetch(url, config);
    let responseData;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }
    console.log(`Response status: ${response.status}, data:`, responseData);
    return {
      statusCode: response.status,
      headers: corsHeaders,
      body: JSON.stringify({
        success: response.ok,
        data: responseData,
        status: response.status
      })
    };
  } catch (error) {
    console.error("WhatsApp proxy error:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
