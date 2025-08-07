<script setup>
import { useLayout } from '@/layout/composables/layout';
import { computed, ref, watch } from 'vue';

// นำเข้าคอมโพเนนต์ส่วนประกอบของเลย์เอาท์
import AppSidebar from './AppSidebar.vue';
import AppTopbar from './AppTopbar.vue';

// ดึงค่าคอนฟิกและสถานะของเลย์เอาท์
const { layoutConfig, layoutState, isSidebarActive } = useLayout();

// สร้างตัวแปรอ้างอิงสำหรับตรวจจับคลิกนอกพื้นที่
const outsideClickListener = ref(null);

// สังเกตการเปลี่ยนแปลงสถานะของแถบข้างเมนู
watch(isSidebarActive, (newVal) => {
    if (newVal) {
        // เมื่อแถบข้างเปิด ให้ติดตั้งตัวฟังก์คลิกนอกพื้นที่
        bindOutsideClickListener();
    } else {
        // เมื่อแถบข้างปิด ให้ยกเลิกการติดตามคลิก
        unbindOutsideClickListener();
    }
});

// คำนวณคลาสสำหรับคอนเทนเนอร์หลัก
const containerClass = computed(() => {
    return {
        // เงื่อนไขต่างๆ สำหรับการจัดวางเมนู
        'layout-overlay': layoutConfig.menuMode === 'overlay',
        'layout-static': layoutConfig.menuMode === 'static',
        'layout-static-inactive': layoutState.staticMenuDesktopInactive && layoutConfig.menuMode === 'static',
        'layout-overlay-active': layoutState.overlayMenuActive,
        'layout-mobile-active': layoutState.staticMenuMobileActive
    };
});

// ติดตั้งตัวฟังก์คลิกนอกพื้นที่
function bindOutsideClickListener() {
    if (!outsideClickListener.value) {
        outsideClickListener.value = (event) => {
            // ถ้าคลิกนอกพื้นที่ให้ปิดเมนู
            if (isOutsideClicked(event)) {
                layoutState.overlayMenuActive = false;
                layoutState.staticMenuMobileActive = false;
                layoutState.menuHoverActive = false;
            }
        };
        // เพิ่มตัวฟังก์การคลิก
        document.addEventListener('click', outsideClickListener.value);
    }
}

// ยกเลิกการติดตามคลิกนอกพื้นที่
function unbindOutsideClickListener() {
    if (outsideClickListener.value) {
        // ลบตัวฟังก์การคลิก
        document.removeEventListener('click', outsideClickListener.value);
        outsideClickListener.value = null;
    }
}

// ตรวจสอบว่าคลิกนอกพื้นที่เมนูหรือไม่
function isOutsideClicked(event) {
    // หาองค์ประกอบของแถบข้างและปุ่มเมนู
    const sidebarEl = document.querySelector('.layout-sidebar');
    const topbarEl = document.querySelector('.layout-menu-button');

    // ตรวจสอบว่าองค์ประกอบมีอยู่จริงหรือไม่
    if (!sidebarEl || !topbarEl) {
        return true; // ถ้าไม่พบองค์ประกอบ ให้ถือว่าคลิกนอกพื้นที่
    }

    // ตรวจสอบว่าคลิกนอกพื้นที่เหล่านี้หรือไม่
    return !(sidebarEl.isSameNode(event.target) || sidebarEl.contains(event.target) || topbarEl.isSameNode(event.target) || topbarEl.contains(event.target));
}
</script>

<template>
    <div class="layout-wrapper" :class="containerClass">
        <!-- ส่วนหัวของแอป -->
        <app-topbar></app-topbar>

        <!-- แถบข้างเมนู -->
        <app-sidebar></app-sidebar>

        <!-- คอนเทนเนอร์หลัก -->
        <div class="layout-main-container">
            <!-- พื้นที่หลักสำหรับแสดงหน้าต่างๆ -->
            <div class="layout-main">
                <router-view :key="$route.fullPath" />
            </div>

            <!-- ส่วนท้ายของแอป -->
            <!-- <app-footer></app-footer> -->
        </div>

        <!-- เงาสำหรับเอฟเฟกต์การเปิดเมนู -->
        <div class="layout-mask animate-fadein"></div>
    </div>

    <!-- คอมโพเนนต์แสดงการแจ้งเตือน -->
    <Toast />
    <ConfirmDialog />
</template>
