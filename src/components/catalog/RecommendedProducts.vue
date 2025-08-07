<script setup>
import ProductService from '@/services/ProductService';
import RecommendService from '@/services/RecommendService';
import ProductDetailDialog from '@/views/pages/ProductDetailDialog.vue';
import Button from 'primevue/button';
import ProgressSpinner from 'primevue/progressspinner';
import Skeleton from 'primevue/skeleton';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { onBeforeUnmount, onMounted, ref } from 'vue';

const toast = useToast();

// ข้อมูลสำหรับ ProductDetailDialog
const selectedProductCode = ref('');
const showProductDetail = ref(false);

// ข้อมูลสินค้าแนะนำ
const recommendedProducts = ref([]);
const recommendedPage = ref(0);
const recommendedPerPage = ref(10);
const loadingRecommended = ref(true);
const hasMoreRecommended = ref(true);
const scrollContainer = ref(null);

// สำหรับ Skeleton Loading
const initialLoading = ref(true);

// สำหรับ Auto Scroll
const autoScrollInterval = ref(null);
const autoScrollDelay = 3000; // ตั้งเวลาให้เลื่อนทุก 3 วินาที
const isHovering = ref(false); // ใช้ตรวจสอบว่าเมาส์อยู่เหนือคอนเทนเนอร์หรือไม่

onMounted(() => {
    // โหลดข้อมูลสินค้าแนะนำหน้าแรกทันที
    loadRecommendedProducts(0, true);

    // เริ่ม auto scroll หลังจากโหลดข้อมูลเสร็จสิ้น
    setTimeout(() => {
        startAutoScroll();
    }, 1000);
});

// หยุด interval เมื่อออกจากหน้านี้
onBeforeUnmount(() => {
    stopAutoScroll();
});

// เริ่มการเลื่อนอัตโนมัติ
// แก้ไขเฉพาะฟังก์ชัน startAutoScroll เพื่อให้ใช้ระยะเลื่อนเดียวกันกับปุ่มซ้าย-ขวา
function startAutoScroll() {
    if (!scrollContainer.value || isHovering.value) return;

    // ล้าง interval เดิมก่อน (ถ้ามี)
    stopAutoScroll();

    autoScrollInterval.value = setInterval(() => {
        if (!scrollContainer.value || isHovering.value) return;

        const container = scrollContainer.value;
        const maxScrollLeft = container.scrollWidth - container.clientWidth;

        // ถ้าเลื่อนไปจนสุดแล้ว ให้เริ่มต้นใหม่
        if (container.scrollLeft >= maxScrollLeft - 20) {
            container.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
            // ใช้ระยะเลื่อนเดียวกันกับฟังก์ชัน scrollRight (เท่ากับความกว้างของ container)
            container.scrollBy({
                left: container.clientWidth,
                behavior: 'smooth'
            });
        }

        // ตรวจสอบว่าเลื่อนไปใกล้สุดทางขวาหรือไม่ เพื่อโหลดข้อมูลเพิ่ม
        setTimeout(() => {
            if (container.scrollWidth - container.scrollLeft - container.clientWidth < 300 && hasMoreRecommended.value) {
                loadMoreRecommended();
            }
        }, 300);
    }, autoScrollDelay);
}

// หยุดการเลื่อนอัตโนมัติ
function stopAutoScroll() {
    if (autoScrollInterval.value) {
        clearInterval(autoScrollInterval.value);
        autoScrollInterval.value = null;
    }
}

// จัดการเมื่อเมาส์อยู่เหนือคอนเทนเนอร์
function handleMouseEnter() {
    isHovering.value = true;
    stopAutoScroll();
}

// จัดการเมื่อเมาส์ออกจากคอนเทนเนอร์
function handleMouseLeave() {
    isHovering.value = false;
    startAutoScroll();
}

// โหลดข้อมูลสินค้าแนะนำ
async function loadRecommendedProducts(page = 0, reset = false) {
    loadingRecommended.value = true;
    try {
        const result = await RecommendService.getRecommendedProducts(recommendedPerPage.value, page, recommendedPerPage.value);

        if (reset) {
            recommendedProducts.value = result.data;
        } else {
            recommendedProducts.value = [...recommendedProducts.value, ...result.data];
        }

        recommendedPage.value = result.pagination.page;
        hasMoreRecommended.value = RecommendService.hasNextPage(recommendedPage.value, result.pagination);

        // หลังจากโหลดข้อมูลสำเร็จ ยกเลิกสถานะการโหลดเริ่มต้น
        initialLoading.value = false;
    } catch (error) {
        console.error('Error loading recommended products:', error);
        // แสดง Toast แจ้งเตือนเมื่อเกิดข้อผิดพลาด
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถโหลดข้อมูลสินค้าแนะนำได้',
            life: 3000
        });
        initialLoading.value = false;
    } finally {
        loadingRecommended.value = false;
    }
}

// โหลดสินค้าแนะนำหน้าถัดไป
function loadMoreRecommended() {
    if (loadingRecommended.value || !hasMoreRecommended.value) return;

    const nextPage = recommendedPage.value + 1;
    loadRecommendedProducts(nextPage);
}

// เลื่อนไปทางซ้าย
function scrollLeft() {
    if (scrollContainer.value) {
        scrollContainer.value.scrollBy({ left: -scrollContainer.value.clientWidth, behavior: 'smooth' });
    }
}

// ติดตามการเลื่อนของคอนเทนเนอร์
function handleScroll(event) {
    const container = event.target;
    // ถ้าเลื่อนไปใกล้สุดทางขวา และยังมีข้อมูลให้โหลด
    if (container.scrollWidth - container.scrollLeft - container.clientWidth < 300 && hasMoreRecommended.value && !loadingRecommended.value) {
        loadMoreRecommended();
    }
}

// เลื่อนไปทางขวา
function scrollRight() {
    if (scrollContainer.value) {
        const container = scrollContainer.value;
        container.scrollBy({ left: container.clientWidth, behavior: 'smooth' });

        // ตรวจสอบว่าเลื่อนไปใกล้สุดทางขวาหรือยัง
        setTimeout(() => {
            if (container.scrollWidth - container.scrollLeft - container.clientWidth < 300 && hasMoreRecommended.value) {
                loadMoreRecommended();
            }
        }, 300);
    }
}

function getInventoryStatus(soldOut) {
    return soldOut === '1' ? 'OUTOFSTOCK' : 'INSTOCK';
}

// ดูรายละเอียดสินค้า (เปลี่ยนเป็นเปิด Dialog แทน)
function viewProductDetail(product) {
    selectedProductCode.value = product.item_code;
    showProductDetail.value = true;
}

// ฟังก์ชันสำหรับรับการเพิ่มสินค้าลงตะกร้าจาก Dialog
function handleAddedToCart(cartItem) {
    toast.add({
        severity: 'success',
        summary: 'เพิ่มสินค้าแล้ว',
        detail: `เพิ่ม ${cartItem.name} ลงในตะกร้าแล้ว จำนวน ${cartItem.qty} ${cartItem.unit}`,
        life: 1000
    });
}

// ฟังก์ชันเปลี่ยนสถานะรายการโปรด
function toggleFavorite(product, event) {
    if (event) {
        event.stopPropagation();
    }

    // เก็บค่า favorite_item เดิมไว้
    const oldFavoriteStatus = product.favorite_item;

    // สลับค่า favorite_item ระหว่าง "0" และ "1"
    product.favorite_item = product.favorite_item === '1' ? '0' : '1';

    // เรียกใช้งาน API เพื่ออัปเดตสถานะรายการโปรด
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

// ฟังก์ชันสำหรับรับการเปลี่ยนแปลงสถานะรายการโปรดจาก Dialog
function handleFavoriteChanged(data) {
    // หาสินค้าในรายการและอัพเดทสถานะ
    const productToUpdate = recommendedProducts.value.find((p) => p.item_code === data.itemCode);
    if (productToUpdate) {
        productToUpdate.favorite_item = data.isFavorite ? '1' : '0';
    }
}
</script>

<template>
    <Toast position="top-right" />
    <!-- ส่วนสินค้าแนะนำด้านบน -->
    <section class="mb-1 relative">
        <div class="flex justify-between items-center px-4 py-3">
            <h2 class="font-semibold text-xl flex items-center">
                <i class="pi pi-star-fill text-yellow-500 mr-2"></i>
                สินค้าแนะนำ
            </h2>
            <!-- ปุ่มเลื่อนซ้าย-ขวา -->
            <div class="flex gap-2">
                <Button icon="pi pi-chevron-left" rounded outlined size="small" aria-label="เลื่อนไปทางซ้าย" @click="scrollLeft" />
                <Button icon="pi pi-chevron-right" rounded outlined size="small" aria-label="เลื่อนไปทางขวา" @click="scrollRight" />
            </div>
        </div>

        <div class="relative">
            <!-- คอนเทนเนอร์สำหรับการเลื่อน -->
            <div ref="scrollContainer" class="overflow-x-auto pb-2 hide-scrollbar" @scroll="handleScroll" @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave">
                <div class="flex gap-3 px-4" style="width: max-content; min-width: 100%">
                    <!-- Skeleton Loading -->
                    <template v-if="initialLoading">
                        <div v-for="i in 5" :key="i" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm" style="width: 140px; min-width: 140px">
                            <Skeleton height="128px" />
                            <div class="p-2">
                                <Skeleton width="80%" height="12px" class="mb-1" />
                                <Skeleton width="100%" height="14px" class="mb-2" />
                                <div class="flex justify-between items-center mt-2">
                                    <Skeleton width="50%" height="16px" />
                                    <Skeleton shape="circle" size="24px" />
                                </div>
                            </div>
                        </div>
                    </template>

                    <!-- Actual Products -->
                    <template v-else>
                        <div
                            v-for="product in recommendedProducts"
                            :key="product.item_code"
                            class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                            style="width: 140px; min-width: 140px"
                            @click="viewProductDetail(product)"
                        >
                            <div class="relative">
                                <img :src="product.image" :alt="product.item_name" class="w-full h-32 object-contain" @error="$event.target.src = product.imageFallback" />

                                <!-- สถานะสินค้า -->
                                <div class="dark:bg-surface-900 absolute rounded-border" style="left: 3px; top: 3px">
                                    <Tag :value="product.sold_out === '1' ? 'OUTOFSTOCK' : 'INSTOCK'" :severity="getInventoryStatus(product.sold_out)" style="font-size: 0.65rem; padding: 0.15rem 0.3rem" />
                                </div>

                                <!-- แสดงปุ่มรายการโปรด (ใช้รูปแบบใหม่) -->
                                <div class="absolute right-1 top-1 cursor-pointer" @click.stop="toggleFavorite(product, $event)">
                                    <Button
                                        :icon="product.favorite_item === '1' ? 'pi pi-heart-fill' : 'pi pi-heart'"
                                        text
                                        rounded
                                        aria-label="Favorite"
                                        :class="product.favorite_item === '1' ? 'p-button-rounded p-button-text p-button-danger' : 'p-button-rounded p-button-text'"
                                        style="width: 1.5rem; height: 1.5rem; font-size: 0.7rem"
                                    />
                                </div>
                            </div>

                            <div class="p-2">
                                <!-- ชื่อหมวดหมู่ -->
                                <div class="text-xs text-gray-500 truncate">
                                    {{ product.category }}
                                </div>

                                <!-- ชื่อสินค้า -->
                                <div class="text-xs sm:text-sm font-medium line-clamp-2 product-name" v-tooltip="product.item_name">
                                    {{ product.item_name }}
                                </div>
                            </div>
                        </div>

                        <!-- ตัวแสดงสถานะการโหลด -->
                        <div v-if="loadingRecommended && recommendedProducts.length > 0" class="flex items-center justify-center min-w-[60px]">
                            <ProgressSpinner style="width: 30px" />
                        </div>
                    </template>
                </div>
            </div>
        </div>
    </section>

    <!-- ProductDetailDialog -->
    <ProductDetailDialog v-model:visible="showProductDetail" :item-code="selectedProductCode" @added-to-cart="handleAddedToCart" @favorite-changed="handleFavoriteChanged" />
</template>

<style scoped>
/* ซ่อน scrollbar แต่ยังใช้ scroll ได้ */
.hide-scrollbar {
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE and Edge */
    scroll-behavior: smooth; /* ให้การเลื่อนสมูทขึ้น */
}

.hide-scrollbar::-webkit-scrollbar {
    display: none; /* Chrome, Safari, Opera */
}

/* อนิเมชันสำหรับโหลดเพิ่มเติม */
@keyframes fadeIn {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

.fade-in {
    animation: fadeIn 0.3s ease-in-out;
}

/* สไตล์สำหรับปุ่มรายการโปรดขนาดเล็ก */
:deep(.p-button.p-button-text.p-button-rounded) {
    width: 1.5rem !important;
    height: 1.5rem !important;
    padding: 0 !important;
    background-color: rgba(255, 255, 255, 0.8);
}

:deep(.p-button.p-button-text.p-button-rounded.p-button-danger) {
    background-color: rgba(220, 53, 69, 0.9);
}

:deep(.p-button.p-button-text.p-button-rounded .p-button-icon) {
    font-size: 0.7rem;
}

:deep(.p-button.p-button-text.p-button-rounded.p-button-danger .p-button-icon) {
    color: white;
}
</style>
