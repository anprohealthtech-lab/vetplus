# AI Prompt Assistant - Interactive Prompt Builder

## Overview

The AI Prompt Assistant is an interactive chat-based interface that helps users create optimal AI prompts for test result extraction. It provides guided assistance in structuring prompts with proper JSON formatting and analyte-specific instructions.

## Features

### 🤖 Interactive Chat Interface
- Conversational AI that understands your test requirements
- Context-aware suggestions based on selected test group
- Real-time prompt generation and customization

### 🎯 Processing Type Guidance
Three specialized prompt types:

1. **OCR Report** (📄)
   - For printed lab reports with structured text
   - Extracts: parameters, values, units, reference ranges, flags
   - Output: JSON array format

2. **Vision Card** (👁️)
   - For rapid test cards and lateral flow tests
   - Analyzes: control lines, test lines, line intensity
   - Output: JSON object with analyte-specific results

3. **Vision Color** (🎨)
   - For color-based tests (blood grouping, agglutination)
   - Detects: color changes, reaction zones, patterns
   - Output: JSON object with reaction results

### 📋 Automatic JSON Structure
- Automatically uses exact analyte names from your test configuration
- Generates proper JSON format based on processing type
- Includes validation instructions for AI
- Prevents common parsing errors

### 💡 Smart Features
- **Quick Suggestions**: Common actions available as buttons
- **Prompt Templates**: Pre-built structures for each processing type
- **Customization**: Add specific requirements interactively
- **Live Preview**: See the generated prompt before applying

## How to Use

### 1. Access the Assistant

Navigate to **AI Prompt Manager** → Click **"New Prompt"** or edit existing prompt → Click **"AI Assistant"** button

### 2. Select Your Test

The assistant automatically knows:
- Test group name
- All analytes in the test
- Current processing type

### 3. Chat with the Assistant

**Example Conversation:**

```
You: "I need a prompt for blood grouping"