import { createRouter, createWebHistory } from 'vue-router'
import AdminLayout from '@/layouts/AdminLayout.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: AdminLayout,
      redirect: '/integrations',
      children: [
        { path: '/settings', component: () => import('@/views/SettingsView.vue') },
        { path: '/integrations', component: () => import('@/views/IntegrationsView.vue') },
        { path: '/sync', component: () => import('@/views/SyncView.vue') },
        { path: '/articles', component: () => import('@/views/ArticlesView.vue') },
        { path: '/articles/:id', component: () => import('@/views/ArticleDetailView.vue') },
      ],
    },
  ],
})

export default router
