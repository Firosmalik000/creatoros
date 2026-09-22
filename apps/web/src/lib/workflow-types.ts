export type SubmissionStatus = "submitted" | "revision_requested" | "approved";

export type SubmissionFile = {
  id: string;
  submission_id: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  file_path: string;
  download_url: string;
  created_at: string;
};

export type SubmissionRevision = {
  id: string;
  submission_id: string;
  revision_number: number;
  feedback: string;
  requested_by: string;
  requested_by_name?: string;
  created_at: string;
};

export type Submission = {
  id: string;
  order_id: string;
  creator_user_id: string;
  version: number;
  status: SubmissionStatus;
  title: string;
  notes: string;
  files: SubmissionFile[];
  revisions: SubmissionRevision[];
  created_at: string;
  updated_at: string;
};

export type WorkflowSummary = {
  order_id: string;
  order_status: string;
  revision_limit: number;
  revision_count: number;
  submissions: Submission[];
};

export type SubmitFileInput = {
  file_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
};

export type SubmitContentRequest = {
  title: string;
  notes?: string;
  files: SubmitFileInput[];
};

export type RevisionRequest = {
  feedback: string;
};

export type ApproveContentRequest = {
  note?: string;
};

export type UploadedFile = {
  file_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
};
