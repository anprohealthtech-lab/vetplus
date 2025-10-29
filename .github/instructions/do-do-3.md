# WhatsApp Integration Implementation Guide for Different Databases

## Overview
This document provides a comprehensive guide to implement WhatsApp integration in any LIMS system, regardless of the database technology used. It outlines all WhatsApp-related functions, APIs, database tables, and implementation files.

## Core WhatsApp Integration Components

### 1. Database Schema Requirements

#### Primary WhatsApp Tables
```sql
-- WhatsApp Sessions Table (Required)
CREATE TABLE whatsapp_sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    is_authenticated BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    phone_number VARCHAR(50),
    session_data TEXT,
    qr_code_data TEXT,
    strategy VARCHAR(50) DEFAULT 'on_demand',
    last_activity TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Optional fields for advanced features
    last_disconnect_code INTEGER,
    reconnect_attempts INTEGER DEFAULT 0,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Messages Queue Table (Required)
CREATE TABLE messages (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255),
    to_number VARCHAR(50) NOT NULL,
    message_text TEXT,
    message_type VARCHAR(50) DEFAULT 'text', -- 'text', 'image', 'document'
    file_path VARCHAR(500),
    file_name VARCHAR(255),
    file_size INTEGER,
    
    -- Message Status Tracking
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'read', 'failed'
    whatsapp_message_id VARCHAR(255),
    delivery_status VARCHAR(50),
    
    -- Metadata
    template_used VARCHAR(255),
    patient_name VARCHAR(255),
    test_name VARCHAR(255),
    doctor_name VARCHAR(255),
    lab_name VARCHAR(255),
    
    -- Timestamps
    scheduled_at TIMESTAMP,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES whatsapp_sessions(id) ON DELETE SET NULL
);

-- System Logs Table (Recommended)
CREATE TABLE system_logs (
    id VARCHAR(255) PRIMARY KEY,
    level VARCHAR(20) NOT NULL, -- 'info', 'warning', 'error'
    message TEXT NOT NULL,
    service VARCHAR(50), -- 'whatsapp', 'file', 'message'
    user_id VARCHAR(255),
    metadata TEXT, -- JSON string
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Users Table (Must have these WhatsApp-related columns)
ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_integration_available BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_sessions INTEGER DEFAULT 2;
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_preferences TEXT; -- JSON
```

### 2. Core Service Files

#### A. Multi-User WhatsApp Service
**File**: `services/MultiUserWhatsAppService.ts` or equivalent
**Purpose**: Main WhatsApp Web integration service
**Key Functions**:
```typescript
class MultiUserWhatsAppService {
    // Session Management
    async createUserSession(userId: string): Promise<SessionResult>
    async getOrCreateUserSession(userId: string): Promise<UserSession>
    async cleanupUserSession(userId: string): Promise<void>
    
    // Connection Management
    async connectUser(userId: string): Promise<ConnectionResult>
    async disconnectUser(userId: string): Promise<void>
    async getUserConnectionStatus(userId: string): Promise<ConnectionStatus>
    
    // Message Operations
    async sendMessage(userId: string, to: string, message: string): Promise<MessageResult>
    async sendDocument(userId: string, to: string, filePath: string, caption?: string): Promise<MessageResult>
    async sendImage(userId: string, to: string, imagePath: string, caption?: string): Promise<MessageResult>
    
    // QR Code Generation
    private handleQRCode(userId: string, qr: string): void
    
    // Connection Event Handlers
    private handleUserConnectionUpdate(userId: string, update: ConnectionUpdate): void
    private handleUserReady(userId: string, user: WhatsAppUser): void
    
    // Database Cleanup (New)
    private async performDatabaseCleanup(): Promise<void>
    private async cleanupFailedSessions(): Promise<number>
    private scheduleDailyDatabaseCleanup(): void
}
```

#### B. Message Service
**File**: `services/MessageService.ts` or equivalent
**Purpose**: Message queue management and template processing
**Key Functions**:
```typescript
class MessageService {
    // Queue Management
    async queueMessage(messageData: MessageData): Promise<string>
    async processMessageQueue(): Promise<void>
    async getMessageHistory(userId: string, filters?: MessageFilters): Promise<Message[]>
    
    // Template Processing
    private processMessageTemplate(template: string, data: TemplateData): string
    
    // Status Updates
    async updateMessageStatus(messageId: string, status: MessageStatus): Promise<void>
    async handleDeliveryUpdate(messageId: string, deliveryData: DeliveryData): Promise<void>
}
```

#### C. File Service
**File**: `services/FileService.ts` or equivalent
**Purpose**: File upload and management for WhatsApp attachments
**Key Functions**:
```typescript
class FileService {
    // File Operations
    async saveUploadedFile(file: MulterFile, userId: string): Promise<FileInfo>
    async validateFile(file: MulterFile, type: 'document' | 'image'): Promise<ValidationResult>
    async cleanupOldFiles(): Promise<number>
    
    // File Path Management
    getFilePath(filename: string): string
    generateUniqueFilename(originalName: string): string
}
```

### 3. API Endpoints Implementation

#### A. WhatsApp Connection APIs
```typescript
// File: routes/whatsapp.ts or controllers/WhatsAppController.ts

// QR Code Generation & Connection
POST /api/users/:userId/whatsapp/connect
GET  /api/users/:userId/whatsapp/status
POST /api/users/:userId/whatsapp/disconnect

// QR Code WebSocket Events
WebSocket: /ws
Events: 'user-qr-code', 'user-connected', 'user-disconnected'
```

**Implementation Example**:
```typescript
// Connect endpoint - generates QR code
router.post('/users/:userId/whatsapp/connect', async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await multiUserWhatsAppService.createUserSession(userId);
        
        if (result.success) {
            res.json({
                success: true,
                sessionId: result.sessionId,
                message: result.qrCode ? 'QR code generated' : 'Session reused'
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.error
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Connection failed',
            error: error.message
        });
    }
});

// Status endpoint
router.get('/users/:userId/whatsapp/status', async (req, res) => {
    try {
        const { userId } = req.params;
        const status = await multiUserWhatsAppService.getUserConnectionStatus(userId);
        res.json(status);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get status'
        });
    }
});
```

#### B. Message Sending APIs
```typescript
// File: routes/messages.ts or controllers/MessageController.ts

// Text Messages
POST /api/send-message
POST /api/users/:userId/whatsapp/send-message

// File Messages (Reports/Images)
POST /api/send-report
POST /api/users/:userId/whatsapp/send-document
POST /api/users/:userId/whatsapp/send-image

// Message History
GET /api/messages
GET /api/users/:userId/messages
```

**Implementation Example**:
```typescript
// Send text message
router.post('/send-message', async (req, res) => {
    try {
        const { userId, to, message, templateData } = req.body;
        
        // Validate input
        if (!userId || !to || !message) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }
        
        // Process template if provided
        let processedMessage = message;
        if (templateData) {
            processedMessage = processMessageTemplate(message, templateData);
        }
        
        // Send message
        const result = await multiUserWhatsAppService.sendMessage(userId, to, processedMessage);
        
        res.json({
            success: result.success,
            messageId: result.messageId,
            message: result.success ? 'Message sent successfully' : result.error
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to send message',
            error: error.message
        });
    }
});

// Send document/report
router.post('/send-report', upload.single('file'), async (req, res) => {
    try {
        const { userId, to, caption, patientName, testName } = req.body;
        const file = req.file;
        
        if (!file || !userId || !to) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields or file'
            });
        }
        
        // Save file
        const fileInfo = await fileService.saveUploadedFile(file, userId);
        
        // Send document
        const result = await multiUserWhatsAppService.sendDocument(
            userId, 
            to, 
            fileInfo.path, 
            caption
        );
        
        // Queue message record
        await messageService.queueMessage({
            userId,
            to,
            messageType: 'document',
            filePath: fileInfo.path,
            fileName: fileInfo.name,
            caption,
            templateData: { patientName, testName }
        });
        
        res.json({
            success: result.success,
            messageId: result.messageId,
            message: result.success ? 'Report sent successfully' : result.error
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to send report',
            error: error.message
        });
    }
});
```

### 4. Frontend Integration Files

#### A. WhatsApp Dashboard Component
**File**: `components/WhatsAppDashboard.tsx` or equivalent
**Purpose**: Real-time WhatsApp connection management
**Key Features**:
- QR code display
- Connection status
- Session management
- Real-time updates via WebSocket

```typescript
interface WhatsAppDashboardProps {
    userId: string;
}

const WhatsAppDashboard: React.FC<WhatsAppDashboardProps> = ({ userId }) => {
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    
    // WebSocket connection for real-time updates
    useEffect(() => {
        const ws = new WebSocket('/ws');
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            switch (data.event) {
                case 'user-qr-code':
                    if (data.userId === userId) {
                        setQrCode(data.qrCode);
                        setConnectionStatus('pairing');
                    }
                    break;
                    
                case 'user-connected':
                    if (data.userId === userId) {
                        setConnectionStatus('connected');
                        setQrCode(null);
                        setIsConnecting(false);
                    }
                    break;
                    
                case 'user-disconnected':
                    if (data.userId === userId) {
                        setConnectionStatus('disconnected');
                        setQrCode(null);
                        setIsConnecting(false);
                    }
                    break;
            }
        };
        
        return () => ws.close();
    }, [userId]);
    
    const handleConnect = async () => {
        setIsConnecting(true);
        try {
            const response = await fetch(`/api/users/${userId}/whatsapp/connect`, {
                method: 'POST'
            });
            const result = await response.json();
            
            if (!result.success) {
                console.error('Connection failed:', result.message);
                setIsConnecting(false);
            }
        } catch (error) {
            console.error('Connection error:', error);
            setIsConnecting(false);
        }
    };
    
    return (
        <div className="whatsapp-dashboard">
            <div className="connection-status">
                Status: {connectionStatus}
            </div>
            
            {connectionStatus === 'disconnected' && (
                <button onClick={handleConnect} disabled={isConnecting}>
                    {isConnecting ? 'Connecting...' : 'Connect WhatsApp'}
                </button>
            )}
            
            {qrCode && (
                <div className="qr-code-section">
                    <h3>Scan QR Code with WhatsApp</h3>
                    <img src={qrCode} alt="WhatsApp QR Code" />
                </div>
            )}
        </div>
    );
};
```

#### B. Message History Component
**File**: `components/MessageHistory.tsx` or equivalent
```typescript
interface MessageHistoryProps {
    userId: string;
}

const MessageHistory: React.FC<MessageHistoryProps> = ({ userId }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        fetchMessages();
    }, [userId]);
    
    const fetchMessages = async () => {
        try {
            const response = await fetch(`/api/users/${userId}/messages`);
            const result = await response.json();
            setMessages(result.data || []);
        } catch (error) {
            console.error('Failed to fetch messages:', error);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="message-history">
            <h3>Message History</h3>
            {loading ? (
                <div>Loading...</div>
            ) : (
                <div className="message-list">
                    {messages.map(message => (
                        <div key={message.id} className="message-item">
                            <div className="message-info">
                                <span className="recipient">To: {message.toNumber}</span>
                                <span className="status">{message.status}</span>
                                <span className="timestamp">{new Date(message.createdAt).toLocaleString()}</span>
                            </div>
                            <div className="message-content">
                                {message.messageText || `${message.messageType}: ${message.fileName}`}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
```

### 5. Configuration Files

#### A. Environment Variables
```env
# WhatsApp Configuration
WHATSAPP_MAX_SESSIONS=10
WHATSAPP_MAX_SESSIONS_PER_USER=3
WHATSAPP_CONNECTION_TIMEOUT=60000
WHATSAPP_QR_TIMEOUT=300000
WHATSAPP_KEEP_ALIVE_INTERVAL=25000

# Rate Limiting
ENABLE_RATE_LIMITING=true
RATE_LIMIT_INTERVAL=15000

# File Upload
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=pdf,jpg,jpeg,png
UPLOAD_DIR=./uploads

# Cleanup Configuration
SESSION_CLEANUP_INTERVAL=300000
INACTIVE_SESSION_TIMEOUT=300000
FILE_CLEANUP_INTERVAL=86400000

# Database
DATABASE_URL=your_database_connection_string

# Logging
LOG_LEVEL=info
BAILEYS_LOG_LEVEL=error
```

#### B. WhatsApp Service Configuration
**File**: `config/whatsapp.ts` or equivalent
```typescript
export const whatsappConfig = {
    maxGlobalSessions: parseInt(process.env.WHATSAPP_MAX_SESSIONS || '10'),
    maxUserSessions: parseInt(process.env.WHATSAPP_MAX_SESSIONS_PER_USER || '3'),
    connectionTimeout: parseInt(process.env.WHATSAPP_CONNECTION_TIMEOUT || '60000'),
    qrTimeout: parseInt(process.env.WHATSAPP_QR_TIMEOUT || '300000'),
    keepAliveInterval: parseInt(process.env.WHATSAPP_KEEP_ALIVE_INTERVAL || '25000'),
    authBaseDir: './server/auth',
    uploadsDir: process.env.UPLOAD_DIR || './uploads',
    
    // Browser configuration for WhatsApp Web
    browser: {
        name: 'LIMS WhatsApp Integration',
        version: '1.0.0'
    },
    
    // Message templates
    templates: {
        reportDelivery: 'Hello [PatientName], your [TestName] report from [LabName] is ready. Please find it attached.',
        appointmentReminder: 'Hello [PatientName], this is a reminder for your appointment with [DoctorName] on [AppointmentDate].',
        reviewRequest: 'Hello [PatientName], we hope you are satisfied with our service. Please leave us a review: [ReviewLink]'
    }
};
```

### 6. Database Storage Interface

#### A. Storage Interface Definition
**File**: `interfaces/Storage.ts` or equivalent
```typescript
interface IStorage {
    // WhatsApp Sessions
    createWhatsAppSession(data: WhatsAppSessionData): Promise<string>;
    getWhatsAppSessionsByUserId(userId: string): Promise<WhatsAppSession[]>;
    updateUserWhatsAppSession(userId: string, data: Partial<WhatsAppSession>): Promise<void>;
    deleteWhatsAppSession(sessionId: string): Promise<void>;
    deleteWhatsAppSessionsByUserId(userId: string, exceptSessionId?: string): Promise<number>;
    getAllWhatsAppSessions(): Promise<WhatsAppSession[]>;
    
    // Session Cleanup Methods
    cleanupFailedSessions(): Promise<number>;
    cleanupOrphanedSessions(maxAgeDays?: number): Promise<number>;
    deactivateOtherUserSessions(userId: string, currentSessionId: string): Promise<void>;
    
    // Messages
    createMessage(data: MessageData): Promise<string>;
    getMessagesByUserId(userId: string, filters?: MessageFilters): Promise<Message[]>;
    updateMessage(messageId: string, data: Partial<Message>): Promise<void>;
    getMessageById(messageId: string): Promise<Message | null>;
    
    // System Logs
    createSystemLog(data: SystemLogData): Promise<void>;
    getSystemLogs(filters?: LogFilters): Promise<SystemLog[]>;
    
    // Users
    getUser(userId: string): Promise<User | null>;
    updateUser(userId: string, data: Partial<User>): Promise<void>;
}
```

### 7. Message Template System

#### A. Template Processing
**File**: `utils/messageTemplates.ts` or equivalent
```typescript
interface TemplateData {
    patientName?: string;
    testName?: string;
    doctorName?: string;
    labName?: string;
    reportDate?: string;
    appointmentDate?: string;
    reviewLink?: string;
    [key: string]: string | undefined;
}

export function processMessageTemplate(template: string, data: TemplateData): string {
    let processed = template;
    
    // Replace all template variables
    Object.entries(data).forEach(([key, value]) => {
        if (value) {
            const placeholder = `[${key.charAt(0).toUpperCase() + key.slice(1)}]`;
            processed = processed.replace(new RegExp(placeholder, 'g'), value);
        }
    });
    
    return processed;
}

export const defaultTemplates = {
    reportDelivery: 'Hello [PatientName], your [TestName] report from [LabName] is ready.',
    appointmentReminder: 'Reminder: [PatientName], your appointment with [DoctorName] is on [AppointmentDate].',
    reviewRequest: 'Hello [PatientName], please share your feedback: [ReviewLink]'
};
```

### 8. WebSocket Integration

#### A. WebSocket Server Setup
**File**: `server/websocket.ts` or equivalent
```typescript
import { WebSocketServer } from 'ws';

export function setupWebSocketServer(server: any) {
    const wss = new WebSocketServer({ server, path: '/ws' });
    
    wss.on('connection', (ws) => {
        console.log('WebSocket client connected');
        
        ws.on('close', () => {
            console.log('WebSocket client disconnected');
        });
    });
    
    // Broadcast function for WhatsApp events
    const broadcast = (event: string, data: any) => {
        const message = JSON.stringify({ event, ...data });
        wss.clients.forEach(client => {
            if (client.readyState === client.OPEN) {
                client.send(message);
            }
        });
    };
    
    return { wss, broadcast };
}

// Event types to broadcast
export interface WhatsAppEvents {
    'user-qr-code': {
        userId: string;
        sessionId: string;
        qrCode: string;
        userName: string;
        clinicName: string;
    };
    
    'user-connected': {
        userId: string;
        sessionId: string;
        phoneNumber: string;
        userName: string;
        clinicName: string;
    };
    
    'user-disconnected': {
        userId: string;
        sessionId: string;
        userName: string;
        shouldReconnect: boolean;
    };
    
    'message-sent': {
        userId: string;
        messageId: string;
        to: string;
        status: string;
    };
    
    'message-delivered': {
        messageId: string;
        deliveredAt: string;
    };
}
```

### 9. Implementation Checklist

#### Phase 1: Database Setup
- [ ] Create `whatsapp_sessions` table
- [ ] Create `messages` table  
- [ ] Create `system_logs` table
- [ ] Add WhatsApp columns to `users` table
- [ ] Create necessary indexes for performance

#### Phase 2: Core Services
- [ ] Implement `MultiUserWhatsAppService` class
- [ ] Implement `MessageService` class
- [ ] Implement `FileService` class
- [ ] Set up database storage interface
- [ ] Configure WhatsApp Web integration (Baileys library)

#### Phase 3: API Endpoints
- [ ] WhatsApp connection endpoints (`/connect`, `/status`, `/disconnect`)
- [ ] Message sending endpoints (`/send-message`, `/send-report`)
- [ ] Message history endpoints (`/messages`)
- [ ] File upload handling with Multer

#### Phase 4: Frontend Integration
- [ ] WhatsApp dashboard component with QR code display
- [ ] Message history component
- [ ] Real-time status updates via WebSocket
- [ ] File upload interface for reports

#### Phase 5: Advanced Features
- [ ] Database cleanup system (daily scheduled + immediate)
- [ ] Message template processing
- [ ] File cleanup automation
- [ ] Comprehensive logging and monitoring
- [ ] Error handling and recovery mechanisms

#### Phase 6: Production Setup
- [ ] Environment variable configuration
- [ ] WebSocket server setup
- [ ] Authentication directory structure
- [ ] File upload directory setup
- [ ] Production deployment configuration

### 10. Integration Dependencies

#### Required NPM Packages
```json
{
  "dependencies": {
    "@whiskeysockets/baileys": "^6.x.x",
    "qrcode": "^1.5.3",
    "multer": "^1.4.5",
    "ws": "^8.x.x",
    "uuid": "^9.x.x"
  },
  "devDependencies": {
    "@types/multer": "^1.4.7",
    "@types/ws": "^8.x.x",
    "@types/uuid": "^9.x.x"
  }
}
```

#### System Requirements
- Node.js 18+ 
- Chrome/Chromium browser (for WhatsApp Web automation)
- Sufficient memory (>512MB for WhatsApp sessions)
- Persistent storage for session data and file uploads

This comprehensive guide provides all the necessary components to implement WhatsApp integration in any LIMS system. Adapt the database queries and ORM syntax to match your specific database technology while maintaining the same logical structure and functionality.