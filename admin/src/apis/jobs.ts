import request from "@/utils/request";
import type { Job } from "@/types/api";
import { useAuthStore } from "@/stores/auth";

const base = () => {
  const auth = useAuthStore();
  const wid = auth.activeWorkspaceId?.trim();
  if (!wid) throw new Error("workspace not selected");
  return `/w/${wid}`;
};

export type PagedItems<T> = {
  items: T[];
  total: number;
};

export const listJobs = async (params?: { queue?: string; page?: number; page_size?: number }) => {
  return (await request.get(`${base()}/jobs`, { params })) as PagedItems<Job>;
};

export const getJob = async (id: number) => {
  return (await request.get(`${base()}/jobs/${id}`)) as Job;
};

export const retryJob = async (id: number) => {
  return (await request.post(`${base()}/jobs/${id}/retry`)) as { id: number; scheduledAt: string };
};

export const cancelJob = async (id: number) => {
  return (await request.post(`${base()}/jobs/${id}/cancel`)) as { id: number };
};
