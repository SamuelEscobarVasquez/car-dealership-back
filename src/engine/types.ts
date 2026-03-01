export interface ConversationState {
  userMessage: string;
  vars: Record<string, any>;
  context: string[];
  finalAnswer: string | null;
}

export interface NodeResult {
  output: any;
  nextRoute?: string;
}

export interface NodeHandler {
  type: string;
  run(state: ConversationState, config: Record<string, any>): Promise<NodeResult>;
}

export interface NodeConfig {
  [key: string]: any;
}
