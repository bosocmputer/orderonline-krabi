import AppLayout from '@/layout/AppLayout.vue';
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
    history: createWebHistory(import.meta.env.VITE_APP_BASE_URL),
    routes: [
        {
            path: '/',
            component: AppLayout,
            children: [
                {
                    path: '/',
                    name: 'catalog',
                    meta: { title: 'สินค้า', requiresAuth: false },

                    component: () => import('@/views/pages/Catalog.vue')
                },

                // หน้ารายละเอียดสินค้า
                {
                    path: '/product-detail/:id',
                    name: 'product-detail',
                    component: () => import('@/views/pages/ProductDetail.vue'),
                    props: true
                },
                // หน้าตะกร้าสินค้า
                {
                    path: '/cart',
                    name: 'cart',
                    component: () => import('@/views/pages/CartView.vue')
                },

                // หน้าประวัติการสั่งซื้อ
                {
                    path: 'orders-history',
                    name: 'order-history',
                    component: () => import('@/views/pages/OrderHistory.vue'),
                    meta: {
                        requiresAuth: true,
                        title: 'ประวัติการสั่งซื้อ'
                    }
                },
                // ประวัติเอกสาร
                {
                    path: 'doc-history',
                    name: 'doc-history',
                    component: () => import('@/views/pages/DocHistory.vue'),
                    meta: {
                        requiresAuth: true,
                        title: 'ประวัติเอกสาร'
                    }
                },
                // สถานะการจัดส่ง
                {
                    path: 'order-shipping-status',
                    name: 'order-shipping-status',
                    component: () => import('@/views/pages/OrderShippingStatus.vue'),
                    meta: {
                        requiresAuth: true,
                        title: 'สถานะการจัดส่ง'
                    }
                },
                // ประวัติการรับเงินล่วงหน้า
                {
                    path: 'advance-payment-history',
                    name: 'advance-payment-history',
                    component: () => import('@/views/pages/AdvancePayment.vue'),
                    meta: {
                        requiresAuth: true,
                        title: 'ประวัติการรับเงินล่วงหน้า'
                    }
                }
            ]
        },
        {
            path: '/landing',
            name: 'landing',
            component: () => import('@/views/pages/Landing.vue')
        },
        {
            path: '/pages/notfound',
            name: 'notfound',
            component: () => import('@/views/pages/NotFound.vue')
        },

        {
            path: '/auth/login',
            name: 'login',
            component: () => import('@/views/pages/auth/Login.vue')
        },
        {
            path: '/auth/access',
            name: 'accessDenied',
            component: () => import('@/views/pages/auth/Access.vue')
        },
        {
            path: '/auth/error',
            name: 'error',
            component: () => import('@/views/pages/auth/Error.vue')
        },
        {
            path: '/:pathMatch(.*)*',
            redirect: '/pages/notfound'
        }
    ]
});

// guard
router.beforeEach((to, from, next) => {
    const isAuthenticated = localStorage.getItem('_token');

    if (to.meta.requiresAuth && !isAuthenticated) {
        next({ name: 'login' });
    } else {
        document.title = to.meta.title ? to.meta.title + ' - ' + import.meta.env.VITE_APP_NAME : import.meta.env.VITE_APP_NAME;
        next();
    }
});

export default router;
