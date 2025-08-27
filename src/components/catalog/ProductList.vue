<script setup>
import ProductService from '@/services/ProductService';
import WarehouseService from '@/services/WarehouseList';
import { useAuthenStore } from '@/stores/authen';
import { useCartStore } from '@/stores/cartStore';
import ProductDetailDialog from '@/views/pages/ProductDetailDialog.vue';
import Button from 'primevue/button';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputText from 'primevue/inputtext';
import ProgressSpinner from 'primevue/progressspinner';
import RadioButton from 'primevue/radiobutton';
import Select from 'primevue/select';
import Skeleton from 'primevue/skeleton';
import Tag from 'primevue/tag';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

const props = defineProps({
    selectedCategory: {
        type: String,
        default: 'all'
    }
});

const authenStore = useAuthenStore();
const cartStore = useCartStore();
const isAuthenticated = computed(() => authenStore.isAuthenticated);
const route = useRoute();

const toast = useToast();

// ข้อมูลสำหรับ Dialog
const selectedProductCode = ref('');
const showProductDetail = ref(false);

// ข้อมูลสินค้าและการค้นหา
const products = ref([]);
const searchQuery = ref('');
const loadingProducts = ref(true);
const favoriteFilterActive = ref(false);
const isSearching = ref(false); // เพิ่มตัวแปรสำหรับติดตามสถานะการค้นหา

// ข้อมูลสำหรับ Select ปียางรถยนต์
const currentYear = new Date().getFullYear();
const selectedTireYear = ref(currentYear);
const tireYearOptions = ref([]);

// สร้างตัวเลือกปี (ปีปัจจุบันและย้อนหลัง 5 ปี)
for (let i = 0; i <= 5; i++) {
    tireYearOptions.value.push({
        label: (currentYear - i).toString(),
        value: currentYear - i
    });
}

// ข้อมูลสำหรับการตั้งค่าคลังและประเภทการขาย
const selectedWarehouse = ref(null);
const warehouseOptions = ref([]);
const isLoadingWarehouses = ref(false);
const saleType = ref(1);

// สำหรับ Skeleton Loading
const initialLoading = ref(true);

// ข้อมูลการเพจจิเนชั่น
const pagination = ref({
    total: 0,
    perPage: 10,
    totalPage: 0,
    page: 0
});
const isLoadingMore = ref(false);
const hasMoreItems = ref(true);
const observerTarget = ref(null); // element ที่จะถูกสังเกตสำหรับ Infinite Scroll

// เพิ่มตัวแปรสำหรับควบคุมการแสดงปุ่มกลับขึ้นด้านบน
const showScrollTop = ref(false);

onMounted(() => {
    // ตรวจสอบค่า favorite จาก query parameters
    favoriteFilterActive.value = route.query.favorite === '1';

    // โหลดค่าปียางรถยนต์จาก localStorage (ถ้ามี) ถ้าไม่มี ให้บันทึกเป็นปีปัจจุบัน
    const savedTireYear = localStorage.getItem('_shelf_code');
    if (savedTireYear) {
        selectedTireYear.value = parseInt(savedTireYear);
    } else {
        // บันทึกค่าเริ่มต้น (ปีปัจจุบัน) ลง localStorage
        localStorage.setItem('_shelf_code', currentYear.toString());
    }

    // โหลดค่าการตั้งค่าจาก localStorage
    loadSettingsFromLocalStorage();

    // โหลดรายการคลัง
    loadWarehouses();

    // โหลดข้อมูลสินค้าทันที
    loadProducts();

    // เพิ่ม event listener สำหรับการเลื่อน
    window.addEventListener('scroll', checkScrollPosition);
});

onUnmounted(() => {
    // ทำความสะอาด observer เมื่อออกจากหน้า
    if (observer) {
        observer.disconnect();
    }

    // ลบ event listener เมื่อออกจากหน้า
    window.removeEventListener('scroll', checkScrollPosition);
});

// ตั้งค่า Intersection Observer สำหรับการโหลดข้อมูลแบบ Infinite Scroll
let observer;
function setupInfiniteScroll() {
    // ตรวจสอบว่ามี observer อยู่แล้วหรือไม่
    if (observer) {
        observer.disconnect();
    }

    // สร้าง IntersectionObserver ใหม่
    observer = new IntersectionObserver(
        (entries) => {
            if (entries[0].isIntersecting && !isLoadingMore.value && hasMoreItems.value && !initialLoading.value) {
                console.log('Observer triggered: Loading more products, current page:', pagination.value.page);
                loadMoreProducts();
            }
        },
        { threshold: 0.1, rootMargin: '100px' }
    );

    // เริ่มสังเกต element เมื่อมีการสร้าง element แล้ว
    setTimeout(() => {
        if (observerTarget.value) {
            observer.observe(observerTarget.value);
            console.log('Observer attached to target, hasMoreItems:', hasMoreItems.value);
        } else {
            console.warn('Observer target not found');
        }
    }, 500);
}

// ฟังก์ชันตรวจสอบตำแหน่งการเลื่อน
function checkScrollPosition() {
    // แสดงปุ่มเมื่อเลื่อนลงมากกว่า 300px
    showScrollTop.value = window.scrollY > 300;
}

// ฟังก์ชันสำหรับเลื่อนกลับไปด้านบนสุด
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// โหลดข้อมูลสินค้าหน้าแรก
async function loadProducts() {
    loadingProducts.value = true;
    try {
        const filters = {
            category: props.selectedCategory !== 'all' ? props.selectedCategory : '',
            search: searchQuery.value,
            favorite: favoriteFilterActive.value ? 1 : 0
        };

        const result = await ProductService.getProducts(filters, 0);

        // รีเซ็ตและเพิ่มข้อมูลใหม่
        products.value = result.data;
        pagination.value = result.pagination;

        // ตรวจสอบว่ายังมีข้อมูลให้โหลดต่อหรือไม่
        hasMoreItems.value = pagination.value.page < pagination.value.totalPage - 1;

        // หลังจากโหลดข้อมูลเสร็จ ยกเลิกสถานะการโหลด
        initialLoading.value = false;

        // Setup observer เพียงครั้งเดียวหลังจากโหลดข้อมูลหน้าแรกเสร็จ
        if (!observer) {
            nextTick(() => {
                setupInfiniteScroll();
            });
        }
    } catch (error) {
        console.error('Error loading products:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถโหลดข้อมูลสินค้าได้',
            life: 3000
        });
        // แม้จะมีข้อผิดพลาด ก็ยังต้องยกเลิกสถานะการโหลด
        initialLoading.value = false;
    } finally {
        loadingProducts.value = false;
        isSearching.value = false; // รีเซ็ตสถานะการค้นหา เมื่อโหลดเสร็จ
    }
}

// โหลดข้อมูลสินค้าเพิ่มเติม (สำหรับ infinite scroll)
async function loadMoreProducts() {
    if (isLoadingMore.value || !hasMoreItems.value) return;

    isLoadingMore.value = true;
    console.log('Loading more products, current page:', pagination.value.page);

    try {
        const filters = {
            category: props.selectedCategory !== 'all' ? props.selectedCategory : '',
            search: searchQuery.value,
            favorite: favoriteFilterActive.value ? 1 : 0
        };

        const nextPage = pagination.value.page + 1;
        const result = await ProductService.getProducts(filters, nextPage);

        // เพิ่มข้อมูลลงในอาร์เรย์ products เดิม
        products.value = [...products.value, ...result.data];
        pagination.value = result.pagination;

        // ตรวจสอบว่ายังมีข้อมูลให้โหลดต่อหรือไม่
        hasMoreItems.value = pagination.value.page < pagination.value.totalPage - 1;
        console.log('Has more items:', hasMoreItems.value);
    } catch (error) {
        console.error('Error loading more products:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถโหลดข้อมูลสินค้าเพิ่มเติมได้',
            life: 3000
        });
    } finally {
        isLoadingMore.value = false;
    }
}

// ฟังก์ชันที่เรียกจากปุ่มเพื่อโหลดข้อมูลเพิ่มเติม (กรณี infinite scroll ไม่ทำงาน)
function handleLoadMore() {
    if (!isLoadingMore.value && hasMoreItems.value) {
        loadMoreProducts();
    }
}

function getInventoryStatus(soldOut) {
    return soldOut === '1' ? 'OUTOFSTOCK' : 'INSTOCK';
}

function getInventoryLabel(soldOut) {
    return soldOut === '1' ? 'OUT OF STOCK' : 'INSTOCK';
}

// เพิ่มฟังก์ชัน debounce สำหรับการค้นหา
let searchTimeout = null;
function debouncedSearch() {
    // ยกเลิก timeout เดิมถ้ามี
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    // แสดงสถานะกำลังค้นหา
    isSearching.value = true;

    searchTimeout = setTimeout(() => {
        filterProducts();
        // เมื่อส่งคำขอไปแล้ว ให้ยังคงแสดงสถานะกำลังค้นหาต่อไป
        // สถานะนี้จะถูกรีเซ็ตใน loadProducts เมื่อโหลดเสร็จ
    }, 1000);
}

// กรองและเรียงลำดับสินค้า
function filterProducts() {
    // หยุดและทำความสะอาด observer เก่าก่อน
    if (observer) {
        observer.disconnect();
        observer = null;
    }

    // รีเซ็ตการเพจจิเนชั่น
    pagination.value.page = 0;
    hasMoreItems.value = true;

    // โหลดข้อมูลใหม่
    loadProducts();
}

// เพิ่มฟังก์ชันล้างการค้นหา
function clearSearch() {
    searchQuery.value = '';
    filterProducts();
}

// เปิด Dialog แสดงรายละเอียดสินค้า
function viewProductDetail(product) {
    selectedProductCode.value = product.item_code;
    showProductDetail.value = true;
}

// จัดการเมื่อมีการเพิ่มสินค้าลงตะกร้าจาก Dialog
function handleAddedToCart(cartItem) {
    toast.add({
        severity: 'success',
        summary: 'เพิ่มสินค้าแล้ว',
        detail: `เพิ่ม ${cartItem.name} ลงในตะกร้าแล้ว จำนวน ${cartItem.qty} ${cartItem.unit}`,
        life: 1000
    });
}

// ล้างตัวกรองทั้งหมด
function clearFilters() {
    searchQuery.value = '';
    filterProducts();
}

// ฟังก์ชันเปลี่ยนสถานะรายการโปรด
function toggleFavorite(product, event) {
    // หยุดการกระจายของ event
    if (event) {
        event.stopPropagation();
    }

    // เก็บค่า favorite_item เดิมไว้
    const oldFavoriteStatus = product.favorite_item;

    // สลับค่า favorite_item ระหว่าง "0" และ "1"
    product.favorite_item = product.favorite_item === '1' ? '0' : '1';

    // อัพเดตสถานะโดยไม่ต้องโหลดข้อมูลใหม่ทั้งหมด
    // ให้ส่งคำขอไปที่ API แบบเดิม แต่ไม่ต้องรอผลลัพธ์เพื่อแสดงการเปลี่ยนแปลงในหน้าจอ
    ProductService.updateFavoriteStatus(product.item_code, product.favorite_item).catch((error) => {
        console.error('Error updating favorite status:', error);
        // กรณีมีข้อผิดพลาด ให้คืนค่าสถานะเดิม
        product.favorite_item = oldFavoriteStatus;
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถอัปเดตสถานะรายการโปรดได้',
            life: 3000
        });
    });
}

// ติดตามการเปลี่ยนแปลงของตัวกรอง
watch(
    [() => props.selectedCategory, () => route.query.favorite, () => route.query.timestamp],
    () => {
        // อัปเดตสถานะ favoriteFilterActive จาก query parameters
        favoriteFilterActive.value = route.query.favorite === '1';
        filterProducts();
    },
    { deep: true }
);

// แยกการติดตามการเปลี่ยนแปลงของ searchQuery ออกมา และใช้ debouncedSearch
watch(searchQuery, () => {
    debouncedSearch();
});

// ติดตามการเปลี่ยนแปลงของ products เพื่อตรวจสอบ observer
watch(
    products,
    () => {
        // ลบการ setup observer ใหม่ทุกครั้งที่ products เปลี่ยน
        // ให้ใช้ observer เดิมแทน
        console.log('Products updated, count:', products.value.length);
    },
    { deep: false }
);

// ฟังก์ชันสำหรับจัดการการเปลี่ยนแปลงปียางรถยนต์
// function handleTireYearChange() {
//     // บันทึกค่าลง localStorage
//     localStorage.setItem('_shelf_code', selectedTireYear.value.toString());
//     console.log('Tire year changed to:', selectedTireYear.value);

//     // โหลดข้อมูลสินค้าใหม่ตามปีที่เลือก
//     filterProducts();
// }

// ฟังก์ชันสำหรับจัดการการเปลี่ยนแปลงคลัง
function handleWarehouseChange() {
    try {
        // บันทึกคลังที่เลือก
        if (selectedWarehouse.value) {
            localStorage.setItem('_selectedWarehouse', JSON.stringify(selectedWarehouse.value));
            localStorage.setItem('_warehouseCode', selectedWarehouse.value.code);
            localStorage.setItem('_warehouseName', selectedWarehouse.value.name);
        } else {
            localStorage.removeItem('_selectedWarehouse');
            localStorage.removeItem('_warehouseCode');
            localStorage.removeItem('_warehouseName');
        }

        // โหลดข้อมูลตะกร้าใหม่ถ้าเป็นลูกค้า
        if (authenStore.isCustomer && authenStore.userCode && selectedWarehouse.value) {
            cartStore.loadCartItemsForCustomer(authenStore.userCode, selectedWarehouse.value.code);
        }

        console.log('Warehouse changed to:', selectedWarehouse.value);

        // แสดงข้อความยืนยัน
        toast.add({
            severity: 'success',
            summary: 'เปลี่ยนคลังสำเร็จ',
            detail: selectedWarehouse.value ? `เปลี่ยนเป็นคลัง: ${selectedWarehouse.value.name}` : 'ยกเลิกการเลือกคลัง',
            life: 2000
        });

        // โหลดข้อมูลสินค้าใหม่
        filterProducts();
    } catch (error) {
        console.error('Error changing warehouse:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถเปลี่ยนคลังได้',
            life: 3000
        });
    }
}

// ฟังก์ชันสำหรับจัดการการเปลี่ยนแปลงประเภทการขาย
function handleSaleTypeChange() {
    try {
        // บันทึกประเภทการขาย
        localStorage.setItem('_saleType', saleType.value.toString());
        localStorage.setItem('_saleTypeName', saleType.value === 1 ? 'เงินสด' : 'เงินเชื่อ');

        console.log('Sale type changed to:', saleType.value);

        // แสดงข้อความยืนยัน
        toast.add({
            severity: 'success',
            summary: 'เปลี่ยนประเภทการขายสำเร็จ',
            detail: `เปลี่ยนเป็น: ${saleType.value === 1 ? 'เงินสด' : 'เงินเชื่อ'}`,
            life: 2000
        });

        // โหลดข้อมูลสินค้าใหม่
        filterProducts();
    } catch (error) {
        console.error('Error changing sale type:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถเปลี่ยนประเภทการขายได้',
            life: 3000
        });
    }
}

// ฟังก์ชันโหลดการตั้งค่าจาก localStorage
function loadSettingsFromLocalStorage() {
    try {
        // โหลดข้อมูลคลังที่เลือก
        const savedWarehouse = localStorage.getItem('_selectedWarehouse');
        if (savedWarehouse) {
            selectedWarehouse.value = JSON.parse(savedWarehouse);
        }

        // โหลดประเภทการขาย
        const savedSaleType = localStorage.getItem('_saleType');
        if (savedSaleType) {
            saleType.value = parseInt(savedSaleType);
        }
    } catch (error) {
        console.error('Error loading settings from localStorage:', error);
    }
}

// ฟังก์ชันโหลดรายการคลัง
async function loadWarehouses() {
    try {
        isLoadingWarehouses.value = true;
        const response = await WarehouseService.getWarehouseList();

        if (response && response.success && Array.isArray(response.data)) {
            warehouseOptions.value = response.data;
        } else {
            warehouseOptions.value = [];
        }
    } catch (error) {
        console.error('Error loading warehouses:', error);
        warehouseOptions.value = [];
    } finally {
        isLoadingWarehouses.value = false;
    }
}

function handleFavoriteChanged(data) {
    // หาสินค้าในรายการและอัพเดทสถานะ
    const productToUpdate = products.value.find((p) => p.item_code === data.itemCode);
    if (productToUpdate) {
        productToUpdate.favorite_item = data.isFavorite ? '1' : '0';
    }
}
</script>

<template>
    <div>
        <Toast position="top-right" />

        <!-- การตั้งค่าต่างๆ -->
        <div class="px-3 py-2 border-t border-gray-100 dark:border-gray-700">
            <!-- บรรทัดแรก: ปียางรถยนต์ และคลัง และประเภทการขาย -->
            <div class="flex items-center gap-4 mb-2">
                <!-- <div class="flex items-center gap-2">
                    <label for="tire-year" class="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">ปียางรถยนต์:</label>
                    <Select id="tire-year" v-model="selectedTireYear" :options="tireYearOptions" optionLabel="label" optionValue="value" placeholder="เลือกปี" class="w-32" @change="handleTireYearChange" />
                </div> -->
                <div class="flex items-center gap-2">
                    <label for="warehouse" class="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">คลัง:</label>
                    <Select id="warehouse" v-model="selectedWarehouse" :options="warehouseOptions" optionLabel="name" placeholder="เลือกคลัง" class="w-60" :loading="isLoadingWarehouses" @change="handleWarehouseChange" />
                </div>
                <div class="flex items-center gap-2">
                    <label class="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">ประเภทการขาย:</label>
                    <div class="flex gap-4">
                        <div class="flex items-center">
                            <RadioButton inputId="cash" v-model="saleType" :value="1" @change="handleSaleTypeChange" />
                            <label for="cash" class="ml-2 text-sm">เงินสด</label>
                        </div>
                        <div class="flex items-center">
                            <RadioButton inputId="credit" v-model="saleType" :value="2" @change="handleSaleTypeChange" />
                            <label for="credit" class="ml-2 text-sm">เงินเชื่อ</label>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- ช่องค้นหา -->
        <div class="px-3 py-2 sm:py-3 border-t border-gray-100 dark:border-gray-700">
            <IconField iconPosition="left" class="w-full">
                <InputText v-model="searchQuery" type="text" placeholder="ค้นหาสินค้า" class="w-full" />
                <InputIcon v-if="!isSearching && !searchQuery" class="pi pi-search search-spinner" />
                <InputIcon v-else-if="!isSearching && searchQuery" class="pi pi-times search-spinner cursor-pointer" @click="clearSearch" />
                <InputIcon v-else class="pi pi-spin pi-spinner search-spinner" />
            </IconField>
        </div>

        <!-- เนื้อหาหลัก -->
        <main class="pb-6">
            <!-- Skeleton Loading -->
            <div v-if="initialLoading" class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
                <div v-for="i in 8" :key="i" class="border border-surface-200 dark:border-surface-700 rounded overflow-hidden shadow-sm">
                    <Skeleton height="200px" />
                    <div class="p-3">
                        <Skeleton width="30%" height="12px" class="mb-1" />
                        <Skeleton width="90%" height="16px" class="mb-2" />
                        <Skeleton width="50%" height="12px" class="mb-2" />
                        <div class="flex justify-between items-center">
                            <Skeleton width="40%" height="24px" />
                            <Skeleton shape="circle" size="36px" />
                        </div>
                    </div>
                </div>
            </div>

            <!-- ตารางแสดงสินค้า -->
            <div v-else-if="products && products.length > 0" class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 p-4">
                <!-- ส่วนแสดงสินค้า -->
                <div
                    v-for="product in products"
                    :key="product.item_code"
                    class="border border-surface-200 dark:border-surface-700 rounded overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-shadow"
                    @click="viewProductDetail(product)"
                >
                    <div class="relative">
                        <img :src="product.image" :alt="product.item_name" class="w-full aspect-square object-contain" @error="$event.target.src = product.imageFallback" />

                        <!-- สถานะสินค้า -->
                        <div class="dark:bg-surface-900 absolute rounded-border" style="left: 5px; top: 5px">
                            <Tag :value="getInventoryLabel(product.sold_out)" :severity="getInventoryStatus(product.sold_out)" class="inventory-tag" :class="{ 'out-of-stock': product.sold_out === '1' }" />
                        </div>

                        <!-- แสดงปุ่มรายการโปรด (สามารถคลิกได้) -->
                        <div v-if="isAuthenticated" class="absolute right-2 top-2 cursor-pointer" @click.stop="toggleFavorite(product, $event)">
                            <Button
                                :icon="product.favorite_item === '1' ? 'pi pi-heart-fill' : 'pi pi-heart'"
                                text
                                rounded
                                aria-label="Favorite"
                                :class="product.favorite_item === '1' ? 'p-button-rounded p-button-text p-button-danger' : 'p-button-rounded p-button-text'"
                                style="width: 2rem; height: 2rem"
                            />
                        </div>
                    </div>

                    <div class="p-3">
                        <!-- รหัสสินค้า -->
                        <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">รหัส: {{ product.item_code }}</div>

                        <!-- ชื่อสินค้า -->
                        <div class="mb-2 font-medium text-sm line-clamp-2 product-name" v-tooltip="product.item_name">
                            {{ product.item_name }}
                        </div>

                        <!-- หมวดหมู่ -->
                        <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            {{ product.category }}
                        </div>
                    </div>
                </div>
            </div>

            <!-- สถานะว่าง (ไม่พบสินค้า) -->
            <div v-else-if="!loadingProducts && !initialLoading && products && products.length === 0" class="flex justify-center p-8">
                <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6 w-full max-w-md">
                    <div class="flex flex-col items-center text-center">
                        <i class="pi pi-search text-5xl text-gray-300 dark:text-gray-600 mb-4"></i>
                        <h3 class="text-xl font-medium mb-2">ไม่พบสินค้า</h3>
                        <p class="text-gray-500 dark:text-gray-400 mb-4">ลองปรับเงื่อนไขการค้นหาหรือตัวกรองดูใหม่</p>
                        <Button label="ล้างตัวกรองทั้งหมด" icon="pi pi-filter-slash" outlined class="w-full sm:w-auto" @click="clearFilters" />
                    </div>
                </div>
            </div>

            <!-- สถานะกำลังโหลด -->
            <div v-else-if="loadingProducts && !initialLoading" class="flex justify-center p-8">
                <div class="text-center">
                    <ProgressSpinner style="width: 50px" class="mb-4" />
                    <p class="text-gray-500">กำลังโหลดสินค้า...</p>
                </div>
            </div>

            <!-- ส่วนแสดงการโหลดเพิ่มเติม -->
            <div v-if="products && products.length > 0" class="p-4 flex justify-center">
                <div ref="observerTarget" id="observer-target" class="w-full text-center">
                    <div v-if="isLoadingMore" class="flex justify-center items-center">
                        <ProgressSpinner style="width: 30px" />
                        <span class="ml-2 text-gray-500">กำลังโหลดเพิ่มเติม...</span>
                    </div>
                    <div v-else-if="!hasMoreItems" class="text-gray-500">-- แสดงสินค้าทั้งหมดแล้ว --</div>
                    <div v-if="!hasMoreItems" class="text-gray-500"><Button label="ล้างตัวกรองทั้งหมด" icon="pi pi-filter-slash" outlined class="w-full sm:w-auto" @click="clearFilters" /></div>
                    <div v-else>
                        <p class="text-gray-500 mb-2">เลื่อนลงเพื่อโหลดเพิ่มเติม</p>
                        <!-- เพิ่มปุ่มโหลดเพิ่มเติม กรณี infinite scroll ไม่ทำงาน -->
                        <Button label="โหลดเพิ่มเติม" icon="pi pi-arrow-down" outlined @click="handleLoadMore" :disabled="isLoadingMore || !hasMoreItems" />
                    </div>
                </div>
            </div>
        </main>

        <!-- ปุ่มกลับขึ้นด้านบน -->
        <Button v-show="showScrollTop" icon="pi pi-arrow-up" class="back-to-top-btn" @click="scrollToTop" aria-label="Back to top" />

        <!-- Product Detail Dialog -->
        <ProductDetailDialog v-model:visible="showProductDetail" :item-code="selectedProductCode" @added-to-cart="handleAddedToCart" @favorite-changed="handleFavoriteChanged" />
    </div>
</template>

<style scoped>
/* สไตล์สำหรับ infinite scroll */
#observer-target {
    min-height: 100px;
    margin: 20px 0;
    position: relative;
}

:deep(.inventory-tag) {
    font-size: 0.85rem !important; /* เพิ่มขนาดตัวอักษร */
    font-weight: bold !important;
    padding: 0.5rem 0.7rem !important; /* เพิ่ม padding */
    border-radius: 4px !important;
    letter-spacing: 0.5px !important;
}

/* สไตล์เฉพาะสำหรับ OUT OF STOCK - เน้นให้เด่นชัด */
:deep(.out-of-stock) {
    color: red !important; /* ตัวอักษรสีขาว */
    font-size: 1.1rem !important; /* เพิ่มขนาดตัวอักษร */
}

/* สไตล์สำหรับตำแหน่ง Tag - ปรับตำแหน่งให้เห็นชัดเจน */
.product-tag-container {
    position: absolute;
    left: 8px;
    top: 8px;
    z-index: 10;
}

/* สไตล์สำหรับ spinner การค้นหา */
:deep(.search-spinner) {
    margin-right: 0.5rem;
}

/* สไตล์สำหรับไอคอนปิดการค้นหา */
:deep(.search-spinner.pi-times) {
    cursor: pointer;
}

/* สไตล์สำหรับปุ่มกลับขึ้นด้านบน */
.back-to-top-btn {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 99;
    border-radius: 50%;
    width: 3rem;
    height: 3rem;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    animation: fadeIn 0.3s;
    transition: transform 0.2s;
}

.back-to-top-btn:hover {
    transform: translateY(-3px);
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

@media (max-width: 768px) {
    .back-to-top-btn {
        width: 2.5rem;
        height: 2.5rem;
        bottom: 15px;
        right: 15px;
    }
}
</style>
