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

-- Flow 3: Especialista de Autos CON Validación
INSERT INTO flows (id, name, description, definition, is_active) VALUES (
    'a0000000-0000-0000-0000-000000000003',
    'Especialista de Autos',
    'Flow para consultas de vehículos con validación completa. Solicita presupuesto, condición, descuento empleado y tipo de vehículo.',
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
                "type": "validator.required_fields",
                "position": { "x": 250, "y": 180 },
                "data": {
                    "label": "Validator Autos",
                    "config": {
                        "defaultUseCase": "autos",
                        "useCases": {
                            "autos": {
                                "extract": "autos",
                                "rules": [
                                    {
                                        "field": "budget",
                                        "orFields": ["maxPrice", "minPrice"],
                                        "required": true,
                                        "label": "presupuesto aproximado"
                                    },
                                    {
                                        "field": "condition",
                                        "required": true,
                                        "label": "nuevo o usado"
                                    },
                                    {
                                        "field": "employeeDiscount",
                                        "required": true,
                                        "label": "si cuenta con descuento de empleado"
                                    },
                                    {
                                        "field": "segment",
                                        "required": true,
                                        "label": "tipo de vehículo (Sedán, SUV, Pickup, etc.)"
                                    }
                                ]
                            }
                        }
                    }
                }
            },
            {
                "id": "node-3",
                "type": "autos.specialist.openai",
                "position": { "x": 250, "y": 380 },
                "data": {
                    "label": "Autos Specialist",
                    "config": { "maxResults": 5 }
                }
            },
            {
                "id": "node-4",
                "type": "response.compose",
                "position": { "x": 250, "y": 520 },
                "data": {
                    "label": "Response",
                    "config": {}
                }
            }
        ],
        "edges": [
            { "id": "edge-1", "source": "node-1", "target": "node-2" },
            { "id": "edge-2", "source": "node-2", "target": "node-3", "sourceHandle": "autos", "data": { "condition": "autos" } },
            { "id": "edge-3", "source": "node-2", "target": "node-4", "data": { "condition": "not_ready" } },
            { "id": "edge-4", "source": "node-3", "target": "node-4" }
        ]
    }',
    false
) ON CONFLICT (id) DO NOTHING;

-- Flow 4: Especialista de Citas CON Validación
INSERT INTO flows (id, name, description, definition, is_active) VALUES (
    'a0000000-0000-0000-0000-000000000004',
    'Especialista de Citas',
    'Flow para agendamiento de citas con validación completa. Solicita nombre, fecha, hora, motivo y vehículo de interés.',
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
                "type": "validator.required_fields",
                "position": { "x": 250, "y": 180 },
                "data": {
                    "label": "Validator Citas",
                    "config": {
                        "defaultUseCase": "dates",
                        "useCases": {
                            "dates": {
                                "extract": "dates",
                                "rules": [
                                    {
                                        "field": "fullName",
                                        "required": true,
                                        "label": "nombre completo"
                                    },
                                    {
                                        "field": "date",
                                        "orFields": ["dayOfWeek"],
                                        "required": true,
                                        "label": "fecha preferida"
                                    },
                                    {
                                        "field": "timePreference",
                                        "required": true,
                                        "label": "hora preferida"
                                    },
                                    {
                                        "field": "appointmentReason",
                                        "required": true,
                                        "label": "motivo de la cita (prueba de manejo o asesoría)"
                                    },
                                    {
                                        "field": "vehicleOfInterest",
                                        "required": false,
                                        "label": "vehículo de interés (si aplica)"
                                    }
                                ]
                            }
                        }
                    }
                }
            },
            {
                "id": "node-3",
                "type": "dates.specialist.openai",
                "position": { "x": 250, "y": 400 },
                "data": {
                    "label": "Dates Specialist",
                    "config": { "maxSlots": 5 }
                }
            },
            {
                "id": "node-4",
                "type": "response.compose",
                "position": { "x": 250, "y": 550 },
                "data": {
                    "label": "Response",
                    "config": {}
                }
            }
        ],
        "edges": [
            { "id": "edge-1", "source": "node-1", "target": "node-2" },
            { "id": "edge-2", "source": "node-2", "target": "node-3", "sourceHandle": "dates", "data": { "condition": "dates" } },
            { "id": "edge-3", "source": "node-2", "target": "node-4", "data": { "condition": "not_ready" } },
            { "id": "edge-4", "source": "node-3", "target": "node-4" }
        ]
    }',
    false
) ON CONFLICT (id) DO NOTHING;

-- Flow 5: Orquestador Multi-Especialista con Validators separados
INSERT INTO flows (id, name, description, definition, is_active) VALUES (
    'a0000000-0000-0000-0000-000000000005',
    'Orquestador Multi-Especialista',
    'Flow completo con orquestador y validadores separados para cada especialista (Consultas, Autos, Citas). Cada validador tiene sus propias reglas.',
    '{
        "startNodeId": "node-1",
        "nodes": [
            {
                "id": "node-1",
                "type": "memory.load",
                "position": { "x": 450, "y": 30 },
                "data": {
                    "label": "Memory Load",
                    "config": { "maxTurns": 15 }
                }
            },
            {
                "id": "node-2",
                "type": "orchestrator.openai",
                "position": { "x": 450, "y": 130 },
                "data": {
                    "label": "Orchestrator",
                    "config": {}
                }
            },
            {
                "id": "node-3",
                "type": "validator.required_fields",
                "position": { "x": 100, "y": 260 },
                "data": {
                    "label": "Validator Consultas",
                    "config": {
                        "useCases": {
                            "faq": {
                                "extract": "consultation",
                                "rules": [
                                    {
                                        "field": "customerType",
                                        "required": true,
                                        "label": "si es cliente nuevo o existente"
                                    },
                                    {
                                        "field": "employmentType",
                                        "required": true,
                                        "label": "si es asalariado o independiente"
                                    },
                                    {
                                        "field": "age",
                                        "required": true,
                                        "label": "edad aproximada"
                                    }
                                ]
                            }
                        }
                    }
                }
            },
            {
                "id": "node-4",
                "type": "validator.required_fields",
                "position": { "x": 350, "y": 260 },
                "data": {
                    "label": "Validator Autos",
                    "config": {
                        "useCases": {
                            "autos": {
                                "extract": "autos",
                                "rules": [
                                    {
                                        "field": "budget",
                                        "orFields": ["maxPrice", "minPrice"],
                                        "required": true,
                                        "label": "presupuesto aproximado"
                                    },
                                    {
                                        "field": "condition",
                                        "required": true,
                                        "label": "nuevo o usado"
                                    },
                                    {
                                        "field": "employeeDiscount",
                                        "required": true,
                                        "label": "si cuenta con descuento de empleado"
                                    },
                                    {
                                        "field": "segment",
                                        "required": true,
                                        "label": "tipo de vehículo (Sedán, SUV, Pickup)"
                                    }
                                ]
                            }
                        }
                    }
                }
            },
            {
                "id": "node-5",
                "type": "validator.required_fields",
                "position": { "x": 600, "y": 260 },
                "data": {
                    "label": "Validator Citas",
                    "config": {
                        "useCases": {
                            "dates": {
                                "extract": "dates",
                                "rules": [
                                    {
                                        "field": "fullName",
                                        "required": true,
                                        "label": "nombre completo"
                                    },
                                    {
                                        "field": "date",
                                        "orFields": ["dayOfWeek"],
                                        "required": true,
                                        "label": "fecha preferida"
                                    },
                                    {
                                        "field": "timePreference",
                                        "required": true,
                                        "label": "hora preferida"
                                    },
                                    {
                                        "field": "appointmentReason",
                                        "required": true,
                                        "label": "motivo (prueba de manejo o asesoría)"
                                    },
                                    {
                                        "field": "vehicleOfInterest",
                                        "required": false,
                                        "label": "vehículo de interés"
                                    }
                                ]
                            }
                        }
                    }
                }
            },
            {
                "id": "node-6",
                "type": "generic.response.openai",
                "position": { "x": 850, "y": 260 },
                "data": {
                    "label": "Generic Response",
                    "config": {}
                }
            },
            {
                "id": "node-7",
                "type": "faq.specialist.openai",
                "position": { "x": 100, "y": 450 },
                "data": {
                    "label": "FAQ Specialist",
                    "config": { "topK": 5 }
                }
            },
            {
                "id": "node-8",
                "type": "autos.specialist.openai",
                "position": { "x": 350, "y": 450 },
                "data": {
                    "label": "Autos Specialist",
                    "config": { "maxResults": 5 }
                }
            },
            {
                "id": "node-9",
                "type": "dates.specialist.openai",
                "position": { "x": 600, "y": 450 },
                "data": {
                    "label": "Dates Specialist",
                    "config": { "maxSlots": 5 }
                }
            },
            {
                "id": "node-10",
                "type": "response.compose",
                "position": { "x": 450, "y": 600 },
                "data": {
                    "label": "Response",
                    "config": {}
                }
            }
        ],
        "edges": [
            { "id": "edge-1", "source": "node-1", "target": "node-2" },
            { "id": "edge-2", "source": "node-2", "target": "node-3", "sourceHandle": "faq", "data": { "condition": "faq" } },
            { "id": "edge-3", "source": "node-2", "target": "node-4", "sourceHandle": "autos", "data": { "condition": "autos" } },
            { "id": "edge-4", "source": "node-2", "target": "node-5", "sourceHandle": "dates", "data": { "condition": "dates" } },
            { "id": "edge-5", "source": "node-2", "target": "node-6", "sourceHandle": "generic", "data": { "condition": "generic" } },
            { "id": "edge-6", "source": "node-3", "target": "node-7", "sourceHandle": "faq", "data": { "condition": "faq" } },
            { "id": "edge-7", "source": "node-3", "target": "node-10", "data": { "condition": "not_ready" } },
            { "id": "edge-8", "source": "node-4", "target": "node-8", "sourceHandle": "autos", "data": { "condition": "autos" } },
            { "id": "edge-9", "source": "node-4", "target": "node-10", "data": { "condition": "not_ready" } },
            { "id": "edge-10", "source": "node-5", "target": "node-9", "sourceHandle": "dates", "data": { "condition": "dates" } },
            { "id": "edge-11", "source": "node-5", "target": "node-10", "data": { "condition": "not_ready" } },
            { "id": "edge-12", "source": "node-6", "target": "node-10" },
            { "id": "edge-13", "source": "node-7", "target": "node-10" },
            { "id": "edge-14", "source": "node-8", "target": "node-10" },
            { "id": "edge-15", "source": "node-9", "target": "node-10" }
        ]
    }',
    false
) ON CONFLICT (id) DO NOTHING;

-- Show created flows
SELECT id, name, is_active FROM flows;
