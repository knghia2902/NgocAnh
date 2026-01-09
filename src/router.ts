import { createRouter, createWebHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import ToolsView from './views/ToolsView.vue'
import ContactView from './views/ContactView.vue'
import AdminView from './views/AdminView.vue'
import LoginView from './views/LoginView.vue'
import ChangePasswordView from './views/ChangePasswordView.vue'
import { authStore } from './stores/auth'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'home',
            component: HomeView
        },
        {
            path: '/projects',
            name: 'projects',
            component: () => import('./views/ProjectsView.vue')
        },
        {
            path: '/tools',
            name: 'tools',
            component: ToolsView
        },
        {
            path: '/contact',
            name: 'contact',
            component: ContactView
        },
        {
            path: '/admin',
            name: 'admin',
            component: AdminView,
            meta: { requiresAuth: true }
        },
        {
            path: '/login',
            name: 'login',
            component: LoginView
        },
        {
            path: '/change-password',
            name: 'change-password',
            component: ChangePasswordView
        }
    ]
})

router.beforeEach((to, _from, next) => {
    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
        next('/login');
    } else if (to.path === '/admin' && authStore.isFirstLogin) {
        next('/change-password');
    } else {
        next();
    }
});

export default router
