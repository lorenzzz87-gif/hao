export type PlanMessage = {
  id: string;
  plan_id: string;
  sender_id: string | null;
  message_type: 'text' | 'system' | 'quick_action';
  body: string;
  created_at: string;
};

export type PlanChatSummary = {
  plan_id: string;
  title: string;
  starts_at: string;
  status: string;
  last_message: string | null;
  last_message_at: string | null;
};

