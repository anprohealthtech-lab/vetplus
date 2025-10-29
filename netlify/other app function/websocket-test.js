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

// netlify/functions/websocket-test.ts
var websocket_test_exports = {};
__export(websocket_test_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(websocket_test_exports);
var handler = async (event, context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  };
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }
  try {
    console.log("Testing WebSocket connectivity to WhatsApp backend...");
    const httpTest = await fetch("https://lionfish-app-nmodi.ondigitalocean.app/api/status");
    const httpResult = httpTest.ok ? await httpTest.json() : null;
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        tests: {
          httpConnectivity: {
            status: httpTest.status,
            ok: httpTest.ok,
            data: httpResult
          },
          websocketUrls: {
            expected: "wss://lionfish-app-nmodi.ondigitalocean.app/ws",
            alternatives: [
              "ws://lionfish-app-nmodi.ondigitalocean.app/ws",
              "wss://lionfish-app-nmodi.ondigitalocean.app:443/ws",
              "ws://lionfish-app-nmodi.ondigitalocean.app:80/ws"
            ]
          },
          browserSupport: {
            websocketAvailable: typeof WebSocket !== "undefined",
            location: typeof window !== "undefined" ? window.location?.origin : "server-side"
          }
        },
        instructions: [
          "Check browser console for WebSocket connection errors",
          "Verify HTTPS/WSS compatibility",
          "Check for CORS or certificate issues",
          'Try connection from browser dev tools: new WebSocket("wss://lionfish-app-nmodi.ondigitalocean.app/ws")'
        ]
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
