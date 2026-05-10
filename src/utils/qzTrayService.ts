/**
 * QZ Tray Service
 * Connects to the locally-installed QZ Tray desktop agent via WebSocket,
 * allowing the web app to send print jobs directly to specific printers
 * without showing the OS print dialog.
 *
 * Requirements:
 *  - QZ Tray must be installed on the workstation: https://qz.io/download/
 *  - On first connect, QZ Tray will prompt the user to allow unsigned printing.
 *    The user should check "Remember this decision" and click Allow.
 */

export type QZConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface BarcodeLabelData {
  sampleId: string;
  patientName: string;
  sampleType?: string;
  date?: string;
}

declare global {
  interface Window {
    qz?: any;
    __qzTrayLoaderPromise?: Promise<any>;
  }
}

const QZ_TRAY_SCRIPT_ID = "qz-tray-script";
const QZ_TRAY_SCRIPT_URL =
  "https://cdn.jsdelivr.net/npm/qz-tray@2.2.6/qz-tray.js";

let connectionStatus: QZConnectionStatus = "disconnected";
let connectionListeners: Array<(status: QZConnectionStatus) => void> = [];

function emitStatus(status: QZConnectionStatus) {
  connectionStatus = status;
  connectionListeners.forEach((listener) => listener(status));
}

export function onConnectionStatusChange(
  fn: (status: QZConnectionStatus) => void,
) {
  connectionListeners.push(fn);
  fn(connectionStatus);
  return () => {
    connectionListeners = connectionListeners.filter((listener) =>
      listener !== fn
    );
  };
}

export function getConnectionStatus(): QZConnectionStatus {
  return connectionStatus;
}

async function getQz(): Promise<any> {
  if (typeof window === "undefined") {
    throw new Error("QZ Tray is only available in the browser.");
  }

  if (window.qz) {
    return window.qz;
  }

  if (!window.__qzTrayLoaderPromise) {
    window.__qzTrayLoaderPromise = new Promise((resolve, reject) => {
      const existingScript = document.getElementById(QZ_TRAY_SCRIPT_ID) as
        | HTMLScriptElement
        | null;

      const resolveIfReady = () => {
        if (window.qz) {
          resolve(window.qz);
        } else {
          reject(
            new Error("QZ Tray script loaded but window.qz is unavailable."),
          );
        }
      };

      if (existingScript) {
        existingScript.addEventListener("load", resolveIfReady, {
          once: true,
        });
        existingScript.addEventListener("error", () => {
          reject(new Error("Failed to load QZ Tray client script."));
        }, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.id = QZ_TRAY_SCRIPT_ID;
      script.src = QZ_TRAY_SCRIPT_URL;
      script.async = true;
      script.onload = resolveIfReady;
      script.onerror = () => {
        reject(new Error("Failed to load QZ Tray client script."));
      };
      document.head.appendChild(script);
    });
  }

  return window.__qzTrayLoaderPromise;
}

function getLoadedQz(): any | null {
  return typeof window !== "undefined" ? window.qz ?? null : null;
}

function configureUnsigned(qz: any) {
  qz.security.setCertificatePromise(
    (_resolve: (cert: string) => void, reject: (err: string) => void) => {
      reject("Unsigned");
    },
  );

  qz.security.setSignaturePromise((_toSign: string) => {
    return (
      resolve: (signature: string) => void,
      _reject: (err: string) => void,
    ) => {
      resolve("");
    };
  });
}

export async function connect(): Promise<void> {
  const qz = await getQz();
  if (qz.websocket.isActive()) return;

  emitStatus("connecting");
  configureUnsigned(qz);

  qz.websocket.setClosedCallbacks(() => {
    emitStatus("disconnected");
  });

  try {
    await qz.websocket.connect({ retries: 2, delay: 1 });
    emitStatus("connected");
  } catch (error) {
    emitStatus("error");
    throw error;
  }
}

export async function disconnect(): Promise<void> {
  const qz = await getQz();
  if (!qz.websocket.isActive()) return;

  await qz.websocket.disconnect();
  emitStatus("disconnected");
}

export function isConnected(): boolean {
  return Boolean(getLoadedQz()?.websocket?.isActive?.());
}

function generateZPL(data: BarcodeLabelData): string {
  const { sampleId, patientName, sampleType, date } = data;
  const dateStr = date || new Date().toLocaleDateString("en-GB");
  const truncatedName = patientName.length > 28
    ? `${patientName.slice(0, 26)}..`
    : patientName;
  const meta = [sampleType, dateStr].filter(Boolean).join(" | ");

  return [
    "^XA",
    "^CF0,28",
    "^FO20,15^BY2",
    "^BCN,55,Y,N,N",
    `^FD${sampleId}^FS`,
    "^FO20,85^A0N,22,22",
    `^FD${truncatedName}^FS`,
    "^FO20,112^A0N,18,18",
    `^FD${meta}^FS`,
    "^XZ",
  ].join("\n");
}

export async function printBarcodeLabel(
  printerName: string,
  data: BarcodeLabelData,
): Promise<void> {
  const qz = await getQz();
  if (!qz.websocket.isActive()) {
    throw new Error("QZ Tray is not connected. Please connect first.");
  }

  const config = qz.configs.create(printerName);
  const zpl = generateZPL(data);

  await qz.print(config, [
    {
      type: "raw",
      format: "plain",
      data: zpl,
    },
  ]);
}

export async function printPDFFromUrl(
  printerName: string,
  pdfUrl: string,
): Promise<void> {
  const qz = await getQz();
  if (!qz.websocket.isActive()) {
    throw new Error("QZ Tray is not connected. Please connect first.");
  }

  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch PDF: ${response.status} ${response.statusText}`,
    );
  }

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  const config = qz.configs.create(printerName);
  await qz.print(config, [
    {
      type: "pixel",
      format: "pdf",
      flavor: "base64",
      data: base64,
    },
  ]);
}
