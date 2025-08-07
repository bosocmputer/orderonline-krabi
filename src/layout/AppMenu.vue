<script setup>
import { useCartStore } from '@/stores/cartStore';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppMenuItem from './AppMenuItem.vue';
import EmployeeInfoDisplay from './EmployeeInfoDisplay.vue';

const cartStore = useCartStore();
const router = useRouter();

// คำนวณจำนวนสินค้าในตะกร้า
const cartItemCount = computed(() => cartStore.totalItems);
const isLoggedIn = ref(!!localStorage.getItem('_token'));
const userName = ref('');
const isEmployee = ref(false); // Add employee state check

// ดึงข้อมูลผู้ใช้จาก localStorage
onMounted(() => {
    if (isLoggedIn.value) {
        const userDataStr = localStorage.getItem('_userData');
        if (userDataStr) {
            try {
                const userData = JSON.parse(userDataStr);
                userName.value = userData.user_name || '';
            } catch (e) {
                console.error('Error parsing user data:', e);
            }
        }

        // Check if user is an employee
        const userType = localStorage.getItem('_userType');
        isEmployee.value = userType === 'employee';
    }
});

// ฟังก์ชันสำหรับออกจากระบบ
const handleLogout = () => {
    // Clear authentication token from localStorage
    localStorage.removeItem('_token');
    // Clear any other user data
    localStorage.clear();
    // อัพเดตสถานะการล็อกอิน
    isLoggedIn.value = false;
    isEmployee.value = false;
    // Redirect to login page
    router.push('/auth/login');
};

// สร้าง computed property สำหรับเมนูตะกร้าสินค้าที่จะอัพเดทโดยอัตโนมัติ
const cartMenuItem = computed(() => ({
    label: 'ตะกร้าสินค้า',
    icon: 'pi pi-fw pi-shopping-cart',
    to: '/cart',
    badge: cartItemCount.value > 0 ? cartItemCount.value.toString() : null,
    badgeClass: 'p-badge-danger'
}));

// จัดเรียงเมนูใหม่
const model = computed(() => {
    const menuItems = [];

    // 1. ส่วนแสดงข้อมูลผู้ใช้งาน (เฉพาะเมื่อล็อกอินแล้ว)
    // if (isLoggedIn.value && userName.value) {
    //     menuItems.push({
    //         label: 'โปรไฟล์',
    //         icon: 'pi pi-fw pi-user',
    //         items: [
    //             {
    //                 label: `ยินดีต้อนรับ ${userName.value}`,
    //                 icon: 'pi pi-fw pi-user',
    //                 disabled: true
    //             }
    //         ]
    //     });
    // }

    // 2. เมนูหลักร้านค้า (แสดงเสมอ)
    menuItems.push({
        label: 'ร้านค้า',
        icon: 'pi pi-fw pi-shopping-bag',
        items: [
            {
                label: 'สินค้าทั้งหมด',
                icon: 'pi pi-fw pi-shopping-bag',
                to: '/'
            },
            cartMenuItem.value
        ]
    });

    // 4. เมนูประวัติต่างๆ (เฉพาะเมื่อล็อกอินแล้ว)
    if (isLoggedIn.value) {
        menuItems.push({
            label: 'ประวัติและการติดตาม',
            icon: 'pi pi-fw pi-history',
            items: [
                { label: 'ประวัติการสั่งซื้อ', icon: 'pi pi-fw pi-shopping-cart', to: '/orders-history' },
                { label: 'ประวัติเอกสาร', icon: 'pi pi-fw pi-file', to: '/doc-history' },
                { label: 'ประวัติการรับเงินล่วงหน้า', icon: 'pi pi-fw pi-wallet', to: '/advance-payment-history' },
                { label: 'สถานะการจัดส่ง', icon: 'pi pi-fw pi-truck', to: '/order-shipping-status' }
            ]
        });
    }

    // 5. เมนูเข้าสู่ระบบ/ออกจากระบบ (แสดงเสมอ)
    menuItems.push({
        label: isLoggedIn.value ? 'บัญชีผู้ใช้' : 'เข้าสู่ระบบ',
        icon: isLoggedIn.value ? 'pi pi-fw pi-user' : 'pi pi-fw pi-sign-in',
        items: [
            {
                label: isLoggedIn.value ? 'ออกจากระบบ' : 'เข้าสู่ระบบ',
                icon: isLoggedIn.value ? 'pi pi-fw pi-sign-out' : 'pi pi-fw pi-sign-in',
                command: () => (isLoggedIn.value ? handleLogout() : router.push('/auth/login'))
            }
        ]
    });

    return menuItems;
});
</script>

<template>
    <!-- Standard user greeting -->
    <div v-if="isLoggedIn && userName && !isEmployee" class="user-info">
        <div class="user-profile">
            <i class="pi pi-user"></i>
            <div class="user-welcome">
                <span class="welcome-text">ยินดีต้อนรับ</span>
                <span class="user-name">{{ userName }}</span>
            </div>
        </div>
    </div>

    <!-- Employee information display -->
    <employee-info-display v-if="isLoggedIn && isEmployee" />

    <ul class="layout-menu">
        <template v-for="(item, i) in model" :key="i">
            <app-menu-item v-if="!item.separator" :item="item" :index="i"></app-menu-item>
            <li v-if="item.separator" class="menu-separator"></li>
        </template>
    </ul>
</template>

<style lang="scss" scoped>
.user-info {
    padding: 1rem;
    margin-bottom: 1rem;
    background-color: var(--surface-card, #ffffff);
    border-radius: 6px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.user-profile {
    display: flex;
    align-items: center;
    gap: 0.75rem;

    i {
        font-size: 1.5rem;
        color: var(--primary-color, #3b82f6);
        background-color: var(--primary-50, #eff6ff);
        border-radius: 50%;
        padding: 0.5rem;
    }

    .user-welcome {
        display: flex;
        flex-direction: column;

        .welcome-text {
            font-size: 0.875rem;
            color: var(--text-color-secondary, #6c757d);
        }

        .user-name {
            font-weight: 600;
            color: var(--text-color, #495057);
        }
    }
}
</style>
