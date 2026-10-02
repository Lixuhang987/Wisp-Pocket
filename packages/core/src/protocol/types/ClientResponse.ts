export type PermissionAnsweredResponse = {
  type: "permission.answered";
  requestId: string;
  timestamp: string;
  payload: {
    decision: "allow" | "deny";
    scope?: "once" | "always";
    reason?: string;
  };
};

export type ClientResponse = PermissionAnsweredResponse;
