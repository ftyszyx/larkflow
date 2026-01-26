import { createRouter, createWebHistory } from 'vue-router'
import AdminLayout from '@/layouts/AdminLayout.vue'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', component: () => import('@/views/LoginView.vue') },
    { path: '/select-workspace', component: () => import('@/views/WorkspaceSelectView.vue') },
    {
      path: '/',
      component: AdminLayout,
      redirect: '/integrations',
      children: [
        { path: '/platform/workspaces', component: () => import('@/views/PlatformWorkspacesView.vue') },
        { path: '/platform/workspaces/:id', component: () => import('@/views/PlatformWorkspaceMembersView.vue') },
        { path: '/members', component: () => import('@/views/MembersView.vue') },
        { path: '/integrations', component: () => import('@/views/IntegrationsView.vue') },
        { path: '/sync', component: () => import('@/views/SyncView.vue') },
        { path: '/jobs', component: () => import('@/views/JobsView.vue') },
        { path: '/articles', component: () => import('@/views/ArticlesView.vue') },
        { path: '/articles/:id', component: () => import('@/views/ArticleDetailView.vue') },
        { path: '/settings', redirect: '/settings/oss' },
        { path: '/settings/oss', component: () => import('@/views/SettingsOssView.vue') },
        { path: '/settings/worker', component: () => import('@/views/SettingsWorkerView.vue') },
      ],
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  if (to.path === '/login') {
    if (!auth.isLoggedIn) return true
    if (!auth.activeWorkspaceId?.trim()) return { path: '/select-workspace' }
    return { path: '/integrations' }
  }

  if (!auth.isLoggedIn) {
    return { path: '/login' }
  }

  if (to.path === '/select-workspace') {
    return true
  }

  if (to.path.startsWith('/platform')) {
    if (!auth.user) return { path: '/select-workspace' }
    if (!auth.user.isPlatformAdmin) return { path: '/integrations' }
    return true
  }

  if (to.path === '/settings/worker') {
    if (!auth.user) return { path: '/select-workspace' }
    if (!auth.user.isPlatformAdmin) return { path: '/integrations' }
    return true
  }

  if (!auth.activeWorkspaceId?.trim()) {
    return { path: '/select-workspace' }
  }

  return true
})

export default router
