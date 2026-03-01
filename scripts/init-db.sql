-- Create database (run as superuser if needed)
-- CREATE DATABASE agent_builder;

-- Connect to agent_builder database

-- Flows table
CREATE TABLE IF NOT EXISTS flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    definition JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY,
    flow_id UUID NOT NULL REFERENCES flows(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Turns table
CREATE TABLE IF NOT EXISTS turns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_flow_id ON conversations(flow_id);
CREATE INDEX IF NOT EXISTS idx_turns_conversation_id ON turns(conversation_id);
CREATE INDEX IF NOT EXISTS idx_flows_is_active ON flows(is_active);

-- Insert example FAQ flow
INSERT INTO flows (id, name, description, definition, is_active) VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'FAQ Simple',
    'Flow simple que responde directamente preguntas FAQ',
    '{
        "startNodeId": "node-1",
        "nodes": [
            {
                "id": "node-1",
                "type": "faq.specialist.openai",
                "position": { "x": 250, "y": 100 },
                "data": {
                    "label": "FAQ Specialist",
                    "config": { "topK": 5 }
                }
            },
            {
                "id": "node-2",
                "type": "response.compose",
                "position": { "x": 250, "y": 300 },
                "data": {
                    "label": "Response",
                    "config": {}
                }
            }
        ],
        "edges": [
            {
                "id": "edge-1",
                "source": "node-1",
                "target": "node-2"
            }
        ]
    }',
    true
) ON CONFLICT (id) DO NOTHING;

-- Insert example orchestrated flow
INSERT INTO flows (id, name, description, definition, is_active) VALUES (
    'a0000000-0000-0000-0000-000000000002',
    'FAQ con Orquestador',
    'Flow completo con memoria, orquestador y rutas condicionales',
    '{
        "startNodeId": "node-1",
        "nodes": [
            {
                "id": "node-1",
                "type": "memory.load",
                "position": { "x": 250, "y": 50 },
                "data": {
                    "label": "Memory Load",
                    "config": { "maxTurns": 10 }
                }
            },
            {
                "id": "node-2",
                "type": "orchestrator.openai",
                "position": { "x": 250, "y": 200 },
                "data": {
                    "label": "Orchestrator",
                    "config": {}
                }
            },
            {
                "id": "node-3",
                "type": "faq.specialist.openai",
                "position": { "x": 100, "y": 350 },
                "data": {
                    "label": "FAQ Specialist",
                    "config": { "topK": 5 }
                }
            },
            {
                "id": "node-4",
                "type": "generic.response.openai",
                "position": { "x": 400, "y": 350 },
                "data": {
                    "label": "Generic Response",
                    "config": {}
                }
            },
            {
                "id": "node-5",
                "type": "response.compose",
                "position": { "x": 250, "y": 500 },
                "data": {
                    "label": "Response",
                    "config": {}
                }
            }
        ],
        "edges": [
            {
                "id": "edge-1",
                "source": "node-1",
                "target": "node-2"
            },
            {
                "id": "edge-2",
                "source": "node-2",
                "target": "node-3",
                "sourceHandle": "faq",
                "data": { "condition": "faq" }
            },
            {
                "id": "edge-3",
                "source": "node-2",
                "target": "node-4",
                "sourceHandle": "generic",
                "data": { "condition": "generic" }
            },
            {
                "id": "edge-4",
                "source": "node-3",
                "target": "node-5"
            },
            {
                "id": "edge-5",
                "source": "node-4",
                "target": "node-5"
            }
        ]
    }',
    false
) ON CONFLICT (id) DO NOTHING;

-- Show created flows
SELECT id, name, is_active FROM flows;
