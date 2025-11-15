import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, Sparkles, Code, FileJson, TestTube, Image, Loader2, X } from 'lucide-react';
import { supabase } from '../../utils/supabase';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    suggestedPrompt?: string;
    analyteNames?: string[];
    processingType?: string;
  };
}

interface PromptAssistantProps {
  testGroupName?: string;
  analytes?: Array<{ id: string; name: string; unit?: string; reference_range?: string }>;
  onPromptGenerated?: (prompt: string, processingType: string) => void;
  currentPrompt?: string;
  processingType?: string;
  onClose?: () => void;
}

export const PromptAssistant: React.FC<PromptAssistantProps> = ({
  testGroupName,
  analytes = [],
  onPromptGenerated,
  currentPrompt,
  processingType: initialProcessingType,
  onClose
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [selectedProcessingType, setSelectedProcessingType] = useState<string>(initialProcessingType || 'vision_color');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Initial greeting
    if (messages.length === 0) {
      const greeting: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `👋 Hello! I'm your AI Prompt Assistant. I'll help you create the perfect prompt for **${testGroupName || 'your test'}**.

I can help you with:
• **Choosing the right AI processing type** (OCR Report, Vision Card, Vision Color)
• **Structuring your prompt** for optimal results
• **Defining JSON output format** matching your analytes
• **Adding specific instructions** for your test requirements

${analytes.length > 0 ? `I see you have ${analytes.length} analytes: ${analytes.slice(0, 3).map(a => a.name).join(', ')}${analytes.length > 3 ? '...' : ''}` : ''}

What would you like help with?`,
        timestamp: new Date()
      };
      setMessages([greeting]);
    }
  }, [testGroupName, analytes]);

  const generatePrompt = (userInput: string, context: {
    processingType: string;
    analyteNames: string[];
    testName: string;
  }): string => {
    const { processingType, analyteNames, testName } = context;

    if (processingType === 'vision_color') {
      return `Analyze the ${testName} test image for color-based diagnostic results.

**Your Task:**
- Examine the image carefully for color changes, agglutination patterns, or reaction zones
- Identify all relevant diagnostic indicators
- Determine the test results based on visual analysis

**Required Output Format:**
Return ONLY a valid JSON object with these exact parameter names:
{
${analyteNames.map(name => `  "${name}": "result value"`).join(',\n')}
}

**Important:**
- Use the EXACT parameter names listed above as JSON keys
- Provide clear, concise result values
- Do NOT include explanatory text outside the JSON
- Ensure the JSON is properly formatted and parseable

Example for reference:
{
  "${analyteNames[0]}": "Positive",
  "${analyteNames[1]}": "Negative"
}`;
    }

    if (processingType === 'vision_card') {
      return `Analyze the ${testName} test card image for diagnostic results.

**Your Task:**
- Locate control lines and test lines
- Identify positive/negative indicators
- Read any visible markings or labels
- Interpret the overall test validity

**Required Output Format:**
Return ONLY a valid JSON object with these exact parameter names:
{
${analyteNames.map(name => `  "${name}": "result value"`).join(',\n')}
}

**Important Guidelines:**
- Look for line presence/absence for rapid tests
- Consider line intensity if relevant
- Check for control line validity
- Use exact parameter names as JSON keys`;
    }

    if (processingType === 'ocr_report') {
      return `Extract laboratory test results from the printed report for ${testName}.

**Your Task:**
- Read all text from the lab report
- Identify parameter names, values, units, and reference ranges
- Extract flags (Normal/High/Low/Abnormal) if present
- Match results to the expected parameters

**Required Output Format:**
Return ONLY a valid JSON array with this structure:
[
${analyteNames.map(name => `  {
    "parameter": "${name}",
    "value": "extracted value",
    "unit": "extracted unit",
    "reference_range": "extracted range",
    "flag": "Normal"
  }`).join(',\n')}
]

**Important:**
- Match parameter names exactly as listed above
- Include all numeric values with proper units
- Extract reference ranges when available
- Set appropriate flags based on reference ranges`;
    }

    return userInput;
  };

  const handleSuggestion = (suggestion: string) => {
    setInput(suggestion);
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsThinking(true);

    try {
      // Call Supabase AI function
      console.log('Calling AI with:', {
        testGroupName,
        analytesCount: analytes?.length || 0,
        analytes: analytes,
        processingType: selectedProcessingType,
        userMessage: input
      });

      const { data, error } = await supabase.functions.invoke('ai-prompt-generator', {
        body: {
          testGroupName,
          analytes,
          processingType: selectedProcessingType,
          currentPrompt,
          userMessage: input
        }
      });

      if (error) throw error;

      console.log('AI Response:', data);

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'I apologize, I could not generate a response.',
        timestamp: new Date(),
        metadata: {
          suggestedPrompt: data.suggestedPrompt,
          analyteNames: data.analyteNames,
          processingType: data.processingType || selectedProcessingType
        }
      };

      setMessages(prev => [...prev, aiResponse]);
      
      // Update processing type if AI detected a different one
      if (data.processingType && data.processingType !== selectedProcessingType) {
        setSelectedProcessingType(data.processingType);
      }
    } catch (error) {
      console.error('Error calling AI:', error);
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorResponse]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleApplyPrompt = (prompt: string, type: string) => {
    if (onPromptGenerated) {
      onPromptGenerated(prompt, type);
    }
  };

  const processingTypeIcons = {
    ocr_report: <FileJson className="w-4 h-4" />,
    vision_card: <TestTube className="w-4 h-4" />,
    vision_color: <Image className="w-4 h-4" />
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-lg shadow-lg border border-gray-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            <h3 className="font-semibold">AI Prompt Assistant</h3>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-white hover:text-purple-200 transition-colors"
              title="Close assistant"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <p className="text-sm text-purple-100 mt-1">
          {testGroupName ? `Creating prompt for: ${testGroupName}` : 'Interactive prompt builder'}
        </p>
      </div>

      {/* Processing Type Selector */}
      <div className="p-3 bg-gray-50 border-b border-gray-200">
        <div className="flex gap-2 text-sm">
          <button
            onClick={() => setSelectedProcessingType('ocr_report')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition ${
              selectedProcessingType === 'ocr_report'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <FileJson className="w-4 h-4" />
            OCR Report
          </button>
          <button
            onClick={() => setSelectedProcessingType('vision_card')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition ${
              selectedProcessingType === 'vision_card'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <TestTube className="w-4 h-4" />
            Vision Card
          </button>
          <button
            onClick={() => setSelectedProcessingType('vision_color')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition ${
              selectedProcessingType === 'vision_color'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Image className="w-4 h-4" />
            Vision Color
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <div className="whitespace-pre-wrap text-sm">{message.content}</div>
              
              {message.metadata?.suggestedPrompt && (
                <div className="mt-3 pt-3 border-t border-gray-300">
                  <button
                    onClick={() => handleApplyPrompt(
                      message.metadata!.suggestedPrompt!,
                      message.metadata!.processingType!
                    )}
                    className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition text-sm font-medium flex items-center gap-2"
                  >
                    <Code className="w-4 h-4" />
                    Apply This Prompt
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isThinking && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
              <span className="text-sm text-gray-600">Thinking...</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestions */}
      {messages.length === 1 && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-600 mb-2">Quick suggestions:</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleSuggestion('Generate a prompt for me')}
              className="text-xs bg-white border border-gray-300 text-gray-700 px-2 py-1 rounded hover:bg-gray-50"
            >
              Generate prompt
            </button>
            <button
              onClick={() => handleSuggestion('Explain the JSON format')}
              className="text-xs bg-white border border-gray-300 text-gray-700 px-2 py-1 rounded hover:bg-gray-50"
            >
              JSON format
            </button>
            <button
              onClick={() => handleSuggestion('Add custom requirements')}
              className="text-xs bg-white border border-gray-300 text-gray-700 px-2 py-1 rounded hover:bg-gray-50"
            >
              Customize
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-white rounded-b-lg">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type your question or request..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={handleSendMessage}
            disabled={!input.trim() || isThinking}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromptAssistant;
