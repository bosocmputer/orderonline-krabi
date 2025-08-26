<script setup>
import { useLayout } from '@/layout/composables/layout';
import ProductService from '@/services/ProductService';
import { useCartStore } from '@/stores/cartStore';
import ToggleSwitch from 'primevue/toggleswitch';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const { toggleMenu } = useLayout();
const router = useRouter();
const appName = ref(import.meta.env.VITE_APP_NAME);
const cartStore = useCartStore();
const showMiniCart = ref(false);
const miniCartTimeout = ref(null);
const miniCartRef = ref(null);
const cartButtonRef = ref(null);
const isCartPage = computed(() => {
    return router.currentRoute.value.path === '/cart';
});

// เพิ่มตัวแปรสำหรับสถานะการค้นหารายการโปรด
const favoriteFilterActive = ref(false);

// เพิ่มตัวแปรสำหรับสถานะการแสดงสินค้าที่มียอดคงเหลือ
const instockFilterActive = ref(false);

// ตรวจสอบการล็อกอิน
const isAuthenticated = computed(() => {
    return !!localStorage.getItem('_token');
});

// ตัวช่วยแสดงจำนวนในรูปแบบที่เหมาะสม
const formatTotal = (value) => {
    return new Intl.NumberFormat('th-TH').format(value);
};

// คำนวณจำนวนสินค้าในตะกร้า
const totalItems = computed(() => cartStore.totalItems);
const totalAmount = computed(() => cartStore.totalAmount);

// แสดงเฉพาะ 3 รายการล่าสุด
const recentItems = computed(() => {
    return [...cartStore.cartItems].slice(0, 3);
});

// มีรายการที่ไม่แสดงอีกกี่รายการ
const hiddenItemsCount = computed(() => {
    return Math.max(0, totalItems.value - recentItems.value.length);
});

// เพิ่มฟังก์ชันสำหรับค้นหารายการโปรด
const searchFavoriteItems = () => {
    // สลับสถานะการกรองรายการโปรด
    favoriteFilterActive.value = !favoriteFilterActive.value;

    // นำทางไปยังหน้าแรกพร้อมพารามิเตอร์สำหรับการกรองรายการโปรด
    router.push({
        path: '/',
        query: {
            favorite: favoriteFilterActive.value ? 1 : 0
        }
    });
};

const goToCart = async () => {
    showMiniCart.value = false;

    // ตรวจสอบว่ามีการล็อกอินหรือไม่
    if (!isAuthenticated.value) {
        // ถ้ายังไม่ได้ล็อกอิน ให้ไปที่หน้า login พร้อม redirect กลับมาที่หน้า cart
        router.push('/auth/login?redirect=/cart');
        return;
    }

    try {
        // ตรวจสอบให้แน่ใจว่าข้อมูลตะกร้าถูกโหลดก่อนนำทางไป
        await cartStore.loadCartItems();
        // นำทางไปยังหน้าตะกร้า
        router.push('/cart');
    } catch (error) {
        console.error('Error loading cart items:', error);
    }
};

const goToLogin = () => {
    showMiniCart.value = false;
    router.push('/auth/login?redirect=/cart');
};

// ตรวจสอบขนาดจอ
const isMobileScreen = () => {
    return window.innerWidth < 640; // sm breakpoint คือ 640px ใน Tailwind
};

// เปลี่ยนจากการนำทางไปหน้าตะกร้าเป็นการแสดง MiniCart
const toggleMiniCart = async (event) => {
    event.stopPropagation();

    // ถ้าอยู่ในหน้า CartView ให้ไม่ทำอะไร และไม่แสดง MiniCart
    if (isCartPage.value) {
        return;
    }

    // ถ้าเป็นหน้าจอขนาด sm หรือเล็กกว่า ให้ไปหน้าตะกร้าโดยตรง
    if (isMobileScreen()) {
        goToCart();
        return;
    }

    try {
        // ตรวจสอบให้แน่ใจว่าข้อมูลตะกร้าถูกโหลดก่อนแสดงมินิคาร์ท
        await cartStore.loadCartItems();
        // แสดงมินิคาร์ท
        showMiniCart.value = !showMiniCart.value;
    } catch (error) {
        console.error('Error loading cart items for mini cart:', error);
    }
};

// แสดง MiniCart
const showMiniCartHandler = async () => {
    // ถ้าอยู่ในหน้า CartView ให้ไม่ทำอะไร
    if (isCartPage.value) {
        return;
    }

    clearTimeout(miniCartTimeout.value);

    if (isAuthenticated.value) {
        try {
            await cartStore.loadCartItems();
        } catch (error) {
            console.error('Error loading cart items for hover:', error);
        }
    }

    showMiniCart.value = true;
};

// ซ่อน MiniCart หลังจากผ่านไป 300ms
const hideMiniCartWithDelay = () => {
    miniCartTimeout.value = setTimeout(() => {
        showMiniCart.value = false;
    }, 300);
};

// ลบสินค้าออกจากตะกร้า
const removeItem = async (itemId, event) => {
    // ป้องกันการนำทางไปยังหน้ารายละเอียดสินค้า
    event.preventDefault();
    event.stopPropagation();

    try {
        // ลบสินค้าจากตะกร้า
        await cartStore.removeFromCart(itemId);

        // อัปเดตข้อมูลตะกร้าทันทีหลังจากลบ
        await cartStore.loadCartItems();

        // แสดงข้อความแจ้งเตือน (ถ้าต้องการ)
        // toast.add({
        //     severity: 'success',
        //     summary: 'ลบสินค้าสำเร็จ',
        //     detail: 'ลบสินค้าออกจากตะกร้าเรียบร้อยแล้ว',
        //     life: 3000
        // });
    } catch (error) {
        console.error('Error removing item from cart:', error);
    }
};
// ตรวจสอบการคลิกนอก MiniCart
const handleClickOutside = (event) => {
    if (showMiniCart.value) {
        // ตรวจสอบว่าคลิกข้างนอก MiniCart และไม่ได้คลิกที่ปุ่มตะกร้า
        if (miniCartRef.value && !miniCartRef.value.contains(event.target) && cartButtonRef.value && !cartButtonRef.value.contains(event.target)) {
            showMiniCart.value = false;
        }
    }
};

// ตรวจสอบขนาดหน้าจอเมื่อมีการเปลี่ยนแปลง
const handleResize = () => {
    // ปิด MiniCart บนหน้าจอขนาดเล็กเสมอ
    if (isMobileScreen() && showMiniCart.value) {
        showMiniCart.value = false;
    }
};

// ลงทะเบียน event listener เมื่อคอมโพเนนต์ถูกโหลด
onMounted(() => {
    document.addEventListener('click', handleClickOutside);
    window.addEventListener('resize', handleResize);

    // ตรวจสอบเริ่มต้น
    handleResize();

    // ตรวจสอบการเปลี่ยนแปลงของ localStorage
    window.addEventListener('storage', checkAuthStatus);

    // โหลดค่าเริ่มต้นของการกรองสินค้าที่มียอดคงเหลือจาก localStorage
    const savedInstockFilter = localStorage.getItem('_isstock');
    // ถ้าค่าใน localStorage เป็น '1' แสดงว่าต้องการแสดงเฉพาะที่มีคงเหลือ (ToggleSwitch = true)
    instockFilterActive.value = savedInstockFilter === '1';

    // ถ้ายังไม่มีค่าใน localStorage ให้เซ็ตค่าเริ่มต้นเป็น '0' (แสดงทั้งหมด)
    if (savedInstockFilter === null) {
        localStorage.setItem('_isstock', '0');
    }

    // เพิ่ม watcher สำหรับตรวจสอบพารามิเตอร์ favorite ในเส้นทาง
    watch(
        () => router.currentRoute.value.query,
        (newQuery) => {
            favoriteFilterActive.value = newQuery.favorite === '1';
        },
        { immediate: true }
    );

    // เพิ่ม watcher เพื่อดักการเปลี่ยนแปลงของเส้นทาง
    watch(
        () => router.currentRoute.value.path,
        (newPath) => {
            // ถ้าเข้าหน้า CartView ให้ปิด MiniCart
            if (newPath === '/cart') {
                showMiniCart.value = false;
            }
        }
    );

    // เพิ่ม watcher สำหรับติดตามการเปลี่ยนแปลงของ instockFilterActive
    watch(instockFilterActive, (newValue) => {
        // อัปเดต localStorage
        localStorage.setItem('_isstock', newValue ? '1' : '0');

        // รีเฟรชข้อมูลสินค้า
        router.push({
            path: '/',
            query: {
                ...router.currentRoute.value.query,
                timestamp: Date.now()
            }
        });
    });
});

// ลบ event listener เมื่อคอมโพเนนต์ถูกทำลาย
onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('storage', checkAuthStatus);
    clearTimeout(miniCartTimeout.value);
});

// ตรวจสอบสถานะการล็อกอิน
const checkAuthStatus = () => {
    // อัพเดทสถานะการล็อกอินเมื่อมีการเปลี่ยนแปลงใน localStorage
    console.log('Auth status changed:', isAuthenticated.value);
};

function getProductImage(itemCode) {
    return itemCode ? ProductService.getProductImageUrl(itemCode) : 'https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg';
}

function handleImageError(event) {
    event.target.src = 'https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg';
}
</script>

<template>
    <div class="layout-topbar">
        <div class="layout-topbar-logo-container">
            <button class="layout-menu-button layout-topbar-action" @click="toggleMenu">
                <i class="pi pi-bars"></i>
            </button>
            <router-link to="/" class="layout-topbar-logo">
                <!-- <img src="../assets/cloud-storage.png" alt="sml-center" width="35" /> -->
                <span>{{ appName }}</span>
            </router-link>
        </div>

        <div class="layout-topbar-actions" :class="isAuthenticated ? 'mt-3' : ''">
            <!-- แสดงสินค้าเฉพาะสินค้าที่มียอดคงเหลือ - ย้ายออกจาก layout-config-menu -->
            <div v-if="isAuthenticated" class="flex items-center justify-center gap-3 px-4 py-2 dark:bg-gray-700 rounded-lg">
                <label class="text-sm cursor-pointer whitespace-nowrap" @click="instockFilterActive = !instockFilterActive"> เฉพาะสินค้าที่มีคงเหลือ </label>
                <ToggleSwitch v-model="instockFilterActive" />
            </div>

            <div class="layout-config-menu">
                <!-- เพิ่มปุ่มค้นหารายการโปรด - แสดงเฉพาะเมื่อล็อกอินแล้ว -->
                <button v-if="isAuthenticated" type="button" class="layout-topbar-action flex items-center justify-center" @click="searchFavoriteItems" :class="{ 'favorite-active': favoriteFilterActive }">
                    <i class="pi" :class="favoriteFilterActive ? 'pi-heart-fill text-red-500' : 'pi-heart'" style="font-size: 1.5rem" />
                    <span class="hidden sm:inline-block ml-2">รายการโปรด</span>
                </button>

                <!-- Cart Icon with OverlayBadge and MiniCart -->
                <div class="relative">
                    <!-- OverlayBadge แสดงเฉพาะเมื่อล็อกอินแล้วและมีสินค้าในตะกร้า -->
                    <OverlayBadge v-if="isAuthenticated" :value="totalItems" severity="danger">
                        <button ref="cartButtonRef" type="button" class="layout-topbar-action flex items-center justify-center" @click="toggleMiniCart" @mouseenter="showMiniCartHandler" @mouseleave="hideMiniCartWithDelay">
                            <i class="pi pi-shopping-cart" style="font-size: 1.5rem" />
                            <span class="hidden sm:inline-block ml-2">ตะกร้าสินค้า</span>
                        </button>
                    </OverlayBadge>

                    <!-- ปุ่มล็อกอินเมื่อไม่มี token -->
                    <button v-else ref="cartButtonRef" type="button" class="layout-topbar-action flex items-center justify-center" @click="goToLogin">
                        <i class="pi pi-sign-in" />
                        <span class="hidden sm:inline-block ml-2">เข้าสู่ระบบ</span>
                    </button>

                    <!-- Mini Cart Dropdown - แสดงเฉพาะเมื่อมี token -->
                    <div
                        v-if="showMiniCart && isAuthenticated && !isCartPage"
                        ref="miniCartRef"
                        class="absolute top-full right-0 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg z-50 p-4 mt-2"
                        @mouseenter="showMiniCartHandler"
                        @mouseleave="hideMiniCartWithDelay"
                    >
                        <div class="flex justify-between items-center pb-2 mb-4 border-b border-gray-100 dark:border-gray-700">
                            <h3 class="text-base font-semibold m-0">ตะกร้าสินค้า</h3>
                            <span class="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 py-1 px-2 rounded-full"> {{ totalItems }} รายการ </span>
                        </div>

                        <div v-if="recentItems.length === 0" class="flex flex-col items-center justify-center py-8 text-gray-500">
                            <i class="pi pi-shopping-cart text-3xl text-gray-300 mb-2"></i>
                            <p>ตะกร้าของคุณว่างเปล่า</p>
                        </div>

                        <div v-else>
                            <div class="max-h-72 overflow-y-auto">
                                <router-link
                                    v-for="item in recentItems"
                                    :key="item.id"
                                    :to="`/product-detail/${item.id}`"
                                    class="flex items-center py-3 border-b border-gray-100 dark:border-gray-700 no-underline text-inherit hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                    <div class="w-12 h-12 mr-3 rounded overflow-hidden border border-gray-200 dark:border-gray-700 flex-shrink-0">
                                        <img :src="getProductImage(item.item_code)" :alt="item.item_code" class="w-full h-full object-contain cursor-pointer" @error="handleImageError" />
                                    </div>
                                    <div class="flex-1">
                                        <div class="text-sm font-medium mb-1 truncate max-w-[180px]">
                                            {{ item.item_name }}
                                        </div>
                                        <div class="text-xs text-gray-500 dark:text-gray-400">{{ item.qty }} x ฿{{ formatTotal(item.price) }}</div>
                                    </div>

                                    <!-- ปุ่มลบแยกออกมาจาก router-link -->
                                    <button class="bg-transparent border-0 cursor-pointer p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full" @click="removeItem(item.id, $event)">
                                        <i class="pi pi-times text-xs"></i>
                                    </button>
                                </router-link>
                            </div>

                            <div v-if="hiddenItemsCount > 0" class="text-center text-xs text-gray-500 py-2 italic">และอีก {{ hiddenItemsCount }} รายการ</div>

                            <div class="flex justify-between items-center py-3 mt-2 border-t border-gray-100 dark:border-gray-700 font-medium">
                                <span>ยอดรวม:</span>
                                <span class="text-base font-semibold text-primary">฿{{ formatTotal(totalAmount) }}</span>
                            </div>

                            <div class="grid grid-cols-2 gap-2 mt-4">
                                <Button label="ดูตะกร้า" class="p-button-outlined text-sm p-2" @click="goToCart" />
                                <Button label="ชำระเงิน" severity="success" class="text-sm p-2" @click="goToCart" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.favorite-active {
    background-color: rgba(244, 114, 182, 0.1);
}
</style>
