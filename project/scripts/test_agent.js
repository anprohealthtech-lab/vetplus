/**
 * Test DO Agent with correct endpoint format
 */

const DO_AGENT_BASE = 'https://sirvwszn3jrtvmxtnirmvwjz.agents.do-ai.run';
const DO_AGENT_KEY = '__DCbWcpyImSHl0kDwhSVAY5Afe2NjQp';
const DO_AGENT_ENDPOINT = `${DO_AGENT_BASE}/api/v1/chat/completions`;

async function testAgent() {
    console.log('🧪 Testing DO Agent with Correct Format\n');
    console.log(`Endpoint: ${DO_AGENT_ENDPOINT}\n`);

    const testPrompt = `You are "ReportTemplateEnhancer". 

Return ONLY this JSON (no markdown, no explanation):
{
  "test": "success",
  "message": "Agent is working!"
}`;

    try {
        const response = await fetch(DO_AGENT_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DO_AGENT_KEY}`
            },
            body: JSON.stringify({
                messages: [
                    { role: 'user', content: testPrompt }
                ],
                stream: false,
                include_retrieval_info: false,
                include_functions_info: false,
                include_guardrails_info: false
            })
        });

        console.log(`Status: ${response.status} ${response.statusText}\n`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Error:', errorText);
            return;
        }

        const data = await response.json();
        console.log('✅ Raw Response:', JSON.stringify(data, null, 2));

        // Extract the agent's message
        if (data.choices && data.choices[0] && data.choices[0].message) {
            const agentMessage = data.choices[0].message.content;
            console.log('\n📝 Agent Message:', agentMessage);

            // Try to parse JSON from message
            try {
                const jsonMatch = agentMessage.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    console.log('\n✅ Parsed JSON:', JSON.stringify(parsed, null, 2));
                }
            } catch (e) {
                console.log('\n⚠️  Could not parse JSON from message');
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testAgent();
