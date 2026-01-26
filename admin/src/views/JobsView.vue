<script setup lang="ts">
import { cancelJob, listJobs, retryJob } from "@/apis/jobs";
import type { Job } from "@/types/api";
import { message } from "ant-design-vue";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useAuthStore } from "@/stores/auth";

const loading = ref(false);
const data = ref<Job[]>([]);

const queue = ref<string | undefined>(undefined);
const pageSize = ref(50);
const currentPage = ref(1);
const total = ref(0);

const auth = useAuthStore();
const streamConnected = ref(false);
let es: EventSource | null = null;

const streamUrl = computed(() => {
  const wid = auth.activeWorkspaceId?.trim();
  const token = auth.token?.trim();
  if (!wid || !token) return "";
  const base = (import.meta.env.VITE_BASE_URL || "/api").replace(/\/$/, "");
  return `${base}/w/${encodeURIComponent(wid)}/jobs/stream?token=${encodeURIComponent(token)}`;
});

const load = async () => {
  loading.value = true;
  try {
    const res = await listJobs({ queue: queue.value, page: currentPage.value, page_size: pageSize.value });
    data.value = res.items;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
};

const onQueueChange = async () => {
  currentPage.value = 1;
  await load();
};

const onTableChange = async (pagination: any) => {
  const nextCurrent = Number(pagination?.current ?? 1);
  const nextPageSize = Number(pagination?.pageSize ?? pageSize.value);
  currentPage.value = Number.isFinite(nextCurrent) && nextCurrent > 0 ? nextCurrent : 1;
  pageSize.value = Number.isFinite(nextPageSize) && nextPageSize > 0 ? nextPageSize : pageSize.value;
  await load();
};

const startStream = () => {
  stopStream();
  const url = streamUrl.value;
  if (!url) return;

  es = new EventSource(url);
  es.onopen = () => {
    streamConnected.value = true;
  };
  es.onerror = () => {
    streamConnected.value = false;
  };
  es.addEventListener("job", async () => {
    // For correctness and simplicity, refresh on any event.
    await load();
  });
};

const stopStream = () => {
  if (es) {
    es.close();
    es = null;
  }
  streamConnected.value = false;
};

const doRetry = async (row: Job) => {
  loading.value = true;
  try {
    await retryJob(row.id);
    message.success("retry scheduled");
    await load();
  } finally {
    loading.value = false;
  }
};

const doCancel = async (row: Job) => {
  loading.value = true;
  try {
    await cancelJob(row.id);
    message.success("canceled");
    await load();
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  await load();
  startStream();
});

onBeforeUnmount(() => {
  stopStream();
});
</script>

<template>
  <a-space direction="vertical" style="width: 100%" :size="16">
    <a-space style="width: 100%; justify-content: space-between">
      <div style="font-size: 18px; font-weight: 600">Jobs</div>
      <a-space :size="8">
        <span style="color: #999; font-size: 12px">stream: {{ streamConnected ? "connected" : "disconnected" }}</span>
        <a-button @click="load" :loading="loading">Refresh</a-button>
      </a-space>
    </a-space>

    <a-space :size="12" style="width: 100%">
      <a-select v-model:value="queue" allowClear placeholder="Queue" style="width: 260px" @change="onQueueChange">
        <a-select-option value="sync_feishu_space">sync_feishu_space</a-select-option>
        <a-select-option value="publish_article">publish_article</a-select-option>
      </a-select>
    </a-space>

    <a-table
      :dataSource="data"
      :loading="loading"
      rowKey="id"
      size="small"
      :pagination="{ current: currentPage, pageSize, total, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }"
      @change="onTableChange"
    >
      <a-table-column title="ID" dataIndex="id" />
      <a-table-column title="Queue" dataIndex="queue" />
      <a-table-column title="Payload">
        <template #default="{ record }">
          <pre style="margin: 0; max-width: 520px; white-space: pre-wrap">{{ JSON.stringify((record as any).payload ?? {}, null, 2) }}</pre>
        </template>
      </a-table-column>
      <a-table-column title="Attempts">
        <template #default="{ record }"> {{ (record as any).attempts }}/{{ (record as any).maxAttempts }} </template>
      </a-table-column>
      <a-table-column title="Scheduled" dataIndex="scheduledAt" />
      <a-table-column title="Locked By" dataIndex="lockedBy" />
      <a-table-column title="Locked Until" dataIndex="lockedUntil" />
      <a-table-column title="Actions">
        <template #default="{ record }">
          <a-space :size="8">
            <a-popconfirm title="Retry this job?" @confirm="doRetry(record as any)">
              <a-button size="small">Retry</a-button>
            </a-popconfirm>
            <a-popconfirm title="Cancel (delete) this job?" @confirm="doCancel(record as any)">
              <a-button size="small" danger>Cancel</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </a-table-column>
    </a-table>
  </a-space>
</template>
