<!-- ProductDetailDialog.vue -->

<script setup>
import ProductService from '@/services/ProductService';
import { useAuthenStore } from '@/stores/authen';
import { useCartStore } from '@/stores/cartStore';
import Badge from 'primevue/badge';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Divider from 'primevue/divider';
import Galleria from 'primevue/galleria';
import OverlayPanel from 'primevue/overlaypanel';
import ProgressSpinner from 'primevue/progressspinner';
import Tag from 'primevue/tag';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    itemCode: {
        type: String,
        default: ''
    }
});

const emit = defineEmits(['update:visible', 'added-to-cart', 'favorite-changed']);

const router = useRouter();
const product = ref(null);
const images = ref([]);
const quantity = ref('1');
const loading = ref(true);
const addingToCart = ref(false); // แยก state การเพิ่มลงตะกร้าออกมาต่างหาก
const toast = useToast();
const cartStore = useCartStore();
const selectedUnitIndex = ref(0);
const shareOverlay = ref(null); // อ้างอิงถึง OverlayPanel สำหรับแชร์

const authenStore = useAuthenStore();
const isLoggedIn = computed(() => authenStore.isAuthenticated);

// สำหรับการแชร์
const shareItems = ref([
    {
        label: 'Facebook',
        icon: 'pi pi-facebook',
        command: () => {
            shareToFacebook();
        }
    },
    {
        label: 'Line',
        icon: 'pi pi-comment',
        command: () => {
            shareToLine();
        }
    },
    {
        label: 'คัดลอกลิงก์',
        icon: 'pi pi-copy',
        command: () => {
            copyLink();
        }
    }
]);

// สไลด์กาลเลอรี่ responsive options
const galleryOptions = ref([
    {
        breakpoint: '992px',
        numVisible: 5
    },
    {
        breakpoint: '768px',
        numVisible: 4
    },
    {
        breakpoint: '576px',
        numVisible: 3
    }
]);

// ตรวจสอบว่าสินค้านี้อยู่ในตะกร้าหรือไม่
const isInCart = computed(() => {
    if (!product.value) return false;
    return cartStore.isInCart(product.value.id || product.value.code);
});

// จำนวนที่มีในตะกร้า
const quantityInCart = computed(() => {
    if (!product.value) return 0;
    const item = cartStore.cartItems.find((item) => item.item_code === (product.value.id || product.value.code));
    return item ? parseInt(item.qty) : 0;
});

const totalSelectedWithCart = computed(() => {
    if (!product.value || !currentUnit.value) return 0;

    // จำนวนที่กำลังเลือกในหน้าต่างปัจจุบัน
    const currentlySelected = parseInt(quantity.value) || 0;

    // จำนวนที่มีในตะกร้าแล้ว (ของหน่วยเดียวกัน)
    const inCartQty = cartStore.cartItems.find((item) => item.item_code === (product.value.id || product.value.code) && item.unit_code === currentUnit.value.unit_code)?.qty || 0;

    // จำนวนรวมทั้งหมด
    return currentlySelected + parseInt(inCartQty);
});

const exceedsAvailableStock = computed(() => {
    if (!currentUnit.value || !currentUnit.value.balance_qty) return false;

    const maxStock = parseInt(currentUnit.value.balance_qty);
    return maxStock > 0 && totalSelectedWithCart.value > maxStock;
});

const remainingStockToAdd = computed(() => {
    if (!currentUnit.value || !currentUnit.value.balance_qty) return 0;

    const maxStock = parseInt(currentUnit.value.balance_qty);
    const inCartQty = cartStore.cartItems.find((item) => item.item_code === (product.value.id || product.value.code) && item.unit_code === currentUnit.value.unit_code)?.qty || 0;

    return Math.max(0, maxStock - parseInt(inCartQty));
});

// หน่วยสินค้าที่กำลังเลือก
const currentUnit = computed(() => {
    if (!product.value || !product.value.otherUnits) return null;

    let unit;
    if (selectedUnitIndex.value === 0) {
        unit = {
            unit_code: product.value.unit_code,
            price: product.value.price,
            sold_out: product.value.sold_out,
            balance_qty: product.value.balance_qty,
            sum_sale: product.value.sum_sale
        };
    } else {
        unit = product.value.otherUnits[selectedUnitIndex.value - 1];
    }

    // Check if balance_qty is 0, set sold_out to '1'
    if (unit.balance_qty === '0' || parseFloat(unit.balance_qty) === 0) {
        unit.sold_out = '1';
    }

    return unit;
});

// ตรวจสอบเมื่อ Dialog เปิดและมี itemCode
watch(
    () => props.visible,
    (newValue) => {
        if (newValue && props.itemCode) {
            // รีเซ็ตค่าต่างๆ เมื่อเปิด Dialog ใหม่
            product.value = null;
            images.value = [];
            quantity.value = '1';
            selectedUnitIndex.value = 0;
            loading.value = true;

            // โหลดข้อมูลสินค้า
            fetchProductDetail();
        }
    }
);

// ตรวจสอบเมื่อ itemCode เปลี่ยน (กรณีเปิด Dialog แล้วเปลี่ยนสินค้า)
watch(
    () => props.itemCode,
    (newValue) => {
        if (props.visible && newValue) {
            // รีเซ็ตค่าต่างๆ เมื่อเปลี่ยนสินค้า
            product.value = null;
            images.value = [];
            quantity.value = '1';
            selectedUnitIndex.value = 0;
            loading.value = true;

            // โหลดข้อมูลสินค้าใหม่
            fetchProductDetail();
        }
    }
);

onMounted(() => {
    // หากมี itemCode และ visible = true ตั้งแต่เริ่มต้น ให้โหลดข้อมูล
    if (props.visible && props.itemCode) {
        fetchProductDetail();
    }
});

function goToLogin() {
    emit('update:visible', false);
    router.push('/auth/login');
}

// ฟังก์ชันสำหรับจัดรูปแบบตัวเลข
function formatNumber(value) {
    const num = parseFloat(value);
    return num.toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// ดึงข้อมูลสินค้า
async function fetchProductDetail() {
    if (!props.itemCode) {
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่พบรหัสสินค้า',
            life: 3000
        });
        emit('update:visible', false);
        return;
    }

    loading.value = true;
    try {
        const result = await ProductService.getProductByItemCode(props.itemCode);

        // Process the data to set sold_out based on balance_qty
        if (result.data) {
            // Check main product
            if (result.data.balance_qty === '0' || parseFloat(result.data.balance_qty) === 0) {
                result.data.sold_out = '1';
            }

            // Check other units if available
            if (result.data.otherUnits && result.data.otherUnits.length > 0) {
                result.data.otherUnits.forEach((unit) => {
                    if (unit.balance_qty === '0' || parseFloat(unit.balance_qty) === 0) {
                        unit.sold_out = '1';
                    }
                });
            }
        }

        product.value = result.data;

        // สร้างรูปภาพสำหรับแกลลอรี่
        const mainImage = {
            itemImageSrc: product.value.image,
            thumbnailImageSrc: product.value.image,
            alt: product.value.name
        };

        // ถ้ามีหลายหน่วย ให้สร้างรูปภาพเดียวกันหลายๆ รูป
        images.value = [mainImage];

        // จำลองรูปภาพเพิ่มเติม (เพื่อให้แกลลอรี่ดูดีขึ้น)
        if (product.value.otherUnits && product.value.otherUnits.length > 0) {
            // เพิ่มรูปภาพเดียวกันอีก 1-2 รูป เพื่อให้แกลลอรี่ดูดีขึ้น
            images.value.push(mainImage);
        }
    } catch (error) {
        console.error('Error fetching product detail:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถโหลดข้อมูลสินค้าได้',
            life: 3000
        });
        emit('update:visible', false);
    } finally {
        loading.value = false;
    }
}

const quantityAtMaxStock = computed(() => {
    if (!currentUnit.value || !currentUnit.value.balance_qty) return false;

    const currentQty = parseInt(quantity.value) || 0;
    const maxStock = parseInt(currentUnit.value.balance_qty);

    return maxStock > 0 && currentQty > maxStock; // เปลี่ยนจาก >= เป็น >
});

// แสดง overlay สำหรับแชร์
function toggleShareMenu(event) {
    shareOverlay.value.toggle(event);
}

function shareToFacebook() {
    if (!product.value) return;

    // สร้าง URL ที่มีพารามิเตอร์ของสินค้า
    const baseUrl = window.location.origin;
    const productPath = `/product/${product.value.code}`;
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(baseUrl + productPath)}`;

    window.open(shareUrl, '_blank', 'width=600,height=400');
    shareOverlay.value.hide();
}

function shareToLine() {
    if (!product.value) return;

    // สร้าง URL ที่มีพารามิเตอร์ของสินค้า
    const baseUrl = window.location.origin;
    const productPath = `/product/${product.value.code}`;
    const shareUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(baseUrl + productPath)}`;

    window.open(shareUrl, '_blank', 'width=600,height=600');
    shareOverlay.value.hide();
}

function copyLink() {
    if (!product.value) return;

    // สร้าง URL ที่มีพารามิเตอร์ของสินค้า
    const baseUrl = window.location.origin;
    const productPath = `/app/product-detail/${product.value.code}`;
    const fullUrl = baseUrl + productPath;

    navigator.clipboard
        .writeText(fullUrl)
        .then(() => {
            toast.add({
                severity: 'success',
                summary: 'คัดลอกลิงก์แล้ว',
                detail: 'คัดลอกลิงก์ไปยังคลิปบอร์ดแล้ว',
                life: 3000
            });
        })
        .catch((error) => {
            console.error('Error copying link:', error);
            toast.add({
                severity: 'error',
                summary: 'เกิดข้อผิดพลาด',
                detail: 'ไม่สามารถคัดลอกลิงก์ได้',
                life: 3000
            });
        });

    shareOverlay.value.hide();
}

function incrementQuantity() {
    if (product.value && currentUnit.value && currentUnit.value.sold_out !== '1') {
        // แปลงค่าเป็นตัวเลขก่อนบวก
        const currentValue = parseInt(quantity.value) || 0;

        // ตรวจสอบว่าจำนวนที่จะเพิ่ม + จำนวนที่มีในตะกร้าแล้ว ไม่เกินจำนวนคงเหลือ
        if (exceedsAvailableStock.value || currentValue >= remainingStockToAdd.value) {
            // ถ้าเกินแล้ว ไม่ให้เพิ่ม และแจ้งเตือนผู้ใช้
            toast.add({
                severity: 'info',
                summary: 'ข้อมูลสต็อก',
                detail: `คุณมีสินค้านี้ในตะกร้าแล้ว ${quantityInCart.value} ${currentUnit.value.unit_code} สามารถเพิ่มได้อีกเพียง ${remainingStockToAdd.value} ${currentUnit.value.unit_code}`,
                life: 3000
            });
            return;
        }

        quantity.value = (currentValue + 1).toString();
    }
}

function decrementQuantity() {
    // แปลงค่าเป็นตัวเลขก่อนลบ
    const currentValue = parseInt(quantity.value) || 0;
    if (currentValue > 1) {
        quantity.value = (currentValue - 1).toString();
    }
}

function addToCart() {
    if (!product.value) return;

    // เตรียมข้อมูลสินค้าสำหรับเพิ่มลงตะกร้า
    const unit = currentUnit.value;
    const cartItem = {
        id: product.value.id || product.value.code,
        item_code: product.value.code,
        code: product.value.code,
        name: product.value.name,
        item_name: product.value.name,
        price: parseFloat(unit.price) || 0,
        image: product.value.image,
        category: product.value.category || '',
        unit: unit.unit_code,
        unit_code: unit.unit_code,
        barcode: product.value.barcode || '',
        wh_code: product.value.wh_code || 'MMA01',
        shelf_code: product.value.shelf_code || 'SH101'
    };

    // แสดงการโหลดเฉพาะปุ่มเพิ่มลงตะกร้า ไม่ใช่ทั้ง dialog
    addingToCart.value = true;

    // ตรวจสอบว่าสินค้านี้มีในตะกร้าแล้วหรือไม่ โดยเช็คทั้ง item_code และ unit_code
    const existingCartItem = cartStore.cartItems.find((item) => item.item_code === cartItem.item_code && item.unit_code === cartItem.unit_code);

    let finalQty = parseInt(quantity.value) || 1;

    // ถ้ามีสินค้านี้ในตะกร้าแล้ว ให้เพิ่มจำนวนเดิม + จำนวนที่ต้องการเพิ่ม
    if (existingCartItem) {
        finalQty = parseInt(existingCartItem.qty) + parseInt(quantity.value);
        cartItem.qty = finalQty;
    }

    cartStore
        .addToCart(cartItem, finalQty)
        .then(() => {
            // แจ้งให้คอมโพเนนต์แม่ทราบว่ามีการเพิ่มสินค้าลงตะกร้าแล้ว
            emit('added-to-cart', cartItem);

            // แสดง toast แจ้งเตือน
            // toast.add({
            //     severity: 'success',
            //     summary: 'เพิ่มสินค้าแล้ว',
            //     detail: `เพิ่ม ${cartItem.name} ลงในตะกร้าแล้ว`,
            //     life: 3000
            // });
        })
        .catch((err) => {
            console.error('Error adding to cart:', err);
            toast.add({
                severity: 'error',
                summary: 'เกิดข้อผิดพลาด',
                detail: 'ไม่สามารถเพิ่มสินค้าลงตะกร้าได้',
                life: 3000
            });
        })
        .finally(() => {
            addingToCart.value = false;
        });
}

// เปลี่ยนหน่วยสินค้า
function changeUnit(index) {
    selectedUnitIndex.value = index;
    // รีเซ็ตจำนวนเมื่อเปลี่ยนหน่วย
    quantity.value = '1';
}

// ฟังก์ชันเปลี่ยนสถานะรายการโปรด
function toggleFavorite() {
    if (!product.value) return;

    // เก็บค่า favorite_item เดิมไว้
    const oldFavoriteStatus = product.value.favorite_item || '0';

    // สลับค่า favorite_item ระหว่าง "0" และ "1"
    product.value.favorite_item = product.value.favorite_item === '1' ? '0' : '1';

    // emit event เพื่อแจ้งให้ ProductList ทราบว่ามีการเปลี่ยนแปลงสถานะรายการโปรด
    emit('favorite-changed', {
        itemCode: product.value.id || product.value.code,
        isFavorite: product.value.favorite_item === '1'
    });

    // เรียกใช้งาน API เพื่ออัปเดตสถานะรายการโปรด
    ProductService.updateFavoriteStatus(product.value.id || product.value.code, product.value.favorite_item).catch((error) => {
        console.error('Error updating favorite status:', error);
        // กรณีมีข้อผิดพลาด ให้คืนค่าสถานะเดิม
        product.value.favorite_item = oldFavoriteStatus;

        // emit event เพื่อแจ้งให้ ProductList ทราบว่ามีการเปลี่ยนแปลงกลับคืน
        emit('favorite-changed', {
            itemCode: product.value.id || product.value.code,
            isFavorite: product.value.favorite_item === '1'
        });

        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถอัปเดตสถานะรายการโปรดได้',
            life: 3000
        });
    });
}

function validateQuantity() {
    // ถ้าค่าว่างเปล่าหรือไม่ใช่ตัวเลข ให้กำหนดเป็น 1
    if (quantity.value === '' || isNaN(parseInt(quantity.value))) {
        quantity.value = '1';
        return;
    }

    // แปลงให้เป็นตัวเลข
    let numValue = parseInt(quantity.value);

    // ตรวจสอบว่าไม่ต่ำกว่า 1
    if (numValue < 1) {
        quantity.value = '1';
        return;
    }

    // ตรวจสอบจำนวนสูงสุดตามสต็อกที่เหลือหลังจากมีในตะกร้าแล้ว
    if (currentUnit.value && currentUnit.value.balance_qty) {
        if (numValue > remainingStockToAdd.value) {
            quantity.value = remainingStockToAdd.value.toString();
            toast.add({
                severity: 'info',
                summary: 'ข้อมูลสต็อก',
                detail: `คุณมีสินค้านี้ในตะกร้าแล้ว ${quantityInCart.value} ${currentUnit.value.unit_code} สามารถเพิ่มได้อีกเพียง ${remainingStockToAdd.value} ${currentUnit.value.unit_code}`,
                life: 3000
            });
        }
    }

    // ตัดศูนย์นำหน้า
    quantity.value = numValue.toString();
}

function getNumericQuantity() {
    const num = parseInt(quantity.value);
    return isNaN(num) ? 0 : num;
}

function handleQuantityKeydown(event) {
    // อนุญาตให้กดปุ่มตัวเลข 0-9 บนคีย์บอร์ดหลักหรือปุ่มตัวเลขด้านข้าง
    const isNumber = /^[0-9]$/.test(event.key);
    // อนุญาตให้กดปุ่ม backspace, delete, tab, arrows
    const isControl = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(event.key);

    if (!isNumber && !isControl) {
        event.preventDefault();
    }
}

function closeDialog() {
    emit('update:visible', false);
}

const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
});
</script>

<template>
    <Dialog
        v-model:visible="dialogVisible"
        modal
        :header="product ? product.name : 'รายละเอียดสินค้า'"
        :style="{ width: '95vw', maxWidth: '900px' }"
        :breakpoints="{ '960px': '95vw', '640px': '100vw' }"
        :closable="true"
        :closeOnEscape="true"
        @hide="closeDialog"
        class="product-detail-dialog"
    >
        <template #header>
            <div class="flex items-center justify-between w-full">
                <div class="text-xl font-medium">{{ product ? product.name : 'รายละเอียดสินค้า' }}</div>
                <div class="flex gap-2">
                    <Button v-if="product" icon="pi pi-share-alt" text rounded aria-label="Share" @click="toggleShareMenu" class="p-button-rounded p-button-text" />
                    <Button
                        v-if="product"
                        :icon="product.favorite_item === '1' ? 'pi pi-heart-fill' : 'pi pi-heart'"
                        text
                        rounded
                        aria-label="Favorite"
                        @click="toggleFavorite"
                        :class="product.favorite_item === '1' ? 'p-button-rounded p-button-text p-button-danger' : 'p-button-rounded p-button-text'"
                    />
                </div>
            </div>
        </template>

        <Toast position="top-right" />
        <OverlayPanel ref="shareOverlay" dismissable>
            <div class="p-2">
                <h4 class="text-lg font-medium mb-3">แชร์</h4>
                <div class="flex flex-col gap-2">
                    <div v-for="(item, i) in shareItems" :key="i" class="flex items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer" @click="item.command">
                        <i :class="[item.icon, 'mr-2 text-lg']"></i>
                        <span>{{ item.label }}</span>
                    </div>
                </div>
            </div>
        </OverlayPanel>

        <!-- Loading state -->
        <div v-if="loading" class="flex justify-center items-center p-6" style="min-height: 300px">
            <ProgressSpinner style="width: 50px" />
        </div>

        <div v-else-if="product" class="product-detail-content">
            <!-- Product content with responsive grid layout -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Product gallery -->
                <div class="relative pt-2">
                    <Galleria v-if="images.length > 0" :value="images" :numVisible="5" :circular="true" :showThumbnails="false" :showItemNavigators="false" :responsiveOptions="galleryOptions" containerClass="w-full">
                        <template #item="slotProps">
                            <img :src="slotProps.item.itemImageSrc" :alt="slotProps.item.alt" @error="$event.target.src = product.imageFallback" class="w-full object-contain" style="max-height: 300px; height: 300px" />
                        </template>
                        <template #thumbnail="slotProps">
                            <img :src="slotProps.item.thumbnailImageSrc" :alt="slotProps.item.alt" @error="$event.target.src = product.imageFallback" class="rounded-sm object-contain" style="width: 70px; height: 40px" />
                        </template>
                    </Galleria>

                    <!-- ถ้าไม่มีรูปภาพ ให้แสดงรูปภาพสำรอง -->
                    <div v-else class="w-full h-[300px] flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                        <img :src="product.imageFallback" :alt="product.name" class="max-h-[250px] max-w-full object-contain" />
                    </div>

                    <!-- Tags positioned on the gallery -->
                    <div class="absolute top-3 left-3 flex flex-col gap-2">
                        <Tag v-if="currentUnit" :value="currentUnit.sold_out === '1' ? 'สินค้าหมด' : 'มีสินค้า'" :severity="currentUnit.sold_out === '1' ? 'danger' : 'success'" class="text-xs sm:text-sm" />
                    </div>
                </div>

                <!-- Product info -->
                <div class="product-info">
                    <div class="mb-3">
                        <div class="text-sm sm:text-base text-gray-500 dark:text-gray-400">
                            รหัสสินค้า: <span class="font-medium">{{ product.code }}</span>
                        </div>
                    </div>

                    <Divider />

                    <!-- ถ้ามีหลายหน่วยให้แสดงตัวเลือกหน่วย -->
                    <div v-if="product.otherUnits && product.otherUnits.length > 0" class="mb-4">
                        <div class="text-base font-medium mb-2">เลือกหน่วย:</div>
                        <div class="flex flex-wrap gap-2">
                            <!-- ปุ่มเลือกหน่วยหลัก -->
                            <Button :label="product.unit_code" :outlined="selectedUnitIndex !== 0" @click="changeUnit(0)" class="text-sm" size="small" />

                            <!-- ปุ่มเลือกหน่วยอื่นๆ -->
                            <Button v-for="(unitItem, idx) in product.otherUnits" :key="idx" :label="unitItem.unit_code" :outlined="selectedUnitIndex !== idx + 1" @click="changeUnit(idx + 1)" class="text-sm" size="small" />
                        </div>
                    </div>

                    <div v-if="currentUnit && currentUnit.sold_out === '1'" class="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 p-3 rounded-lg text-base mb-4 flex items-center">
                        <i class="pi pi-exclamation-triangle mr-2"></i>
                        <span>สินค้าหน่วยนี้หมด ไม่สามารถสั่งซื้อได้</span>
                    </div>

                    <!-- Price section -->
                    <div class="flex items-center mb-4 mt-3" v-if="currentUnit">
                        <!-- แสดงราคาเฉพาะเมื่อเข้าสู่ระบบแล้วเท่านั้น -->
                        <template v-if="isLoggedIn">
                            <span class="text-2xl sm:text-3xl font-bold text-primary"> ฿{{ parseFloat(currentUnit.price).toLocaleString() }} </span>
                            <span class="text-base text-gray-500 ml-2"> / {{ currentUnit.unit_code }} </span>
                        </template>

                        <!-- แสดงข้อความแทนเมื่อยังไม่ได้เข้าสู่ระบบ -->
                        <template v-else>
                            <div class="bg-gray-50 dark:bg-gray-800/30 p-3 rounded-lg w-full text-center">
                                <i class="pi pi-lock mr-2"></i>
                                <span class="text-base">กรุณาเข้าสู่ระบบเพื่อดูราคา</span>
                                <Button icon="pi pi-sign-in" label="เข้าสู่ระบบ" @click="goToLogin" class="mt-2 ml-2 p-button-sm" size="small" />
                            </div>
                        </template>
                    </div>

                    <!-- In cart badge -->
                    <div v-if="isInCart" class="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 p-3 rounded-lg text-base mb-4 flex items-center">
                        <i class="pi pi-info-circle mr-2"></i>
                        <span>มีในตะกร้าแล้ว <Badge :value="quantityInCart" severity="info" class="ml-1"></Badge></span>
                    </div>

                    <div v-if="currentUnit && isInCart && remainingStockToAdd >= 0" class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        สามารถเพิ่มได้อีก: <span class="font-medium">{{ remainingStockToAdd }}</span> {{ currentUnit.unit_code }}
                    </div>

                    <div class="product-stats grid grid-cols-2 gap-4 mb-4">
                        <!-- คงเหลือ -->
                        <div v-if="currentUnit" class="text-base text-gray-600 dark:text-gray-300 p-3 bg-gray-50 dark:bg-gray-800/30 rounded-lg">
                            <div class="font-medium mb-1">คงเหลือ:</div>
                            <div :class="parseFloat(currentUnit.balance_qty) < 0 ? 'text-red-500 font-medium' : 'font-medium'">{{ formatNumber(currentUnit.balance_qty) }} {{ currentUnit.unit_code }}</div>
                        </div>

                        <!--ยอดขาย -->
                        <div v-if="currentUnit" class="text-base text-gray-600 dark:text-gray-300 p-3 bg-gray-50 dark:bg-gray-800/30 rounded-lg">
                            <div class="font-medium mb-1">ยอดขาย:</div>
                            <div :class="parseFloat(currentUnit.sum_sale) < 0 ? 'text-red-500 font-medium' : 'font-medium'">{{ formatNumber(currentUnit.sum_sale) }} {{ currentUnit.unit_code }}</div>
                        </div>
                    </div>

                    <!-- Short description -->
                    <div class="mb-4 mt-3 bg-gray-50 dark:bg-gray-800/30 p-3 rounded-lg">
                        <div class="text-base font-medium mb-2">รายละเอียด</div>
                        <p class="text-sm sm:text-base text-gray-600 dark:text-gray-300 whitespace-pre-line">
                            {{ product.description || 'ไม่มีคำอธิบายสำหรับสินค้านี้' }}
                        </p>
                    </div>

                    <Divider />

                    <!-- Quantity Selector & Add to Cart Button -->
                    <div class="flex items-center w-full max-w-[200px]">
                        <Button icon="pi pi-minus" text rounded @click="decrementQuantity" :disabled="getNumericQuantity() <= 1" class="border border-gray-300 dark:border-gray-700 w-10 h-10 flex items-center justify-center" />
                        <input type="text" v-model="quantity" class="mx-3 font-medium text-center w-12 text-lg border-0 focus:outline-none focus:ring-0 bg-transparent" @blur="validateQuantity" @keydown="handleQuantityKeydown" />
                        <Button icon="pi pi-plus" text rounded @click="incrementQuantity" :disabled="quantityAtMaxStock" class="border border-gray-300 dark:border-gray-700 w-10 h-10 flex items-center justify-center" />
                    </div>

                    <!-- Action Buttons -->
                    <div class="gap-3 mt-4">
                        <!-- กรณีเข้าสู่ระบบแล้ว แสดงปุ่มเพิ่มลงตะกร้า -->
                        <Button
                            v-if="isLoggedIn"
                            icon="pi pi-shopping-cart"
                            label="เพิ่มลงตะกร้า"
                            @click="addToCart"
                            :disabled="(currentUnit && currentUnit.sold_out === '1') || exceedsAvailableStock || parseInt(quantity.value) <= 0 || parseInt(quantity.value) > remainingStockToAdd"
                            :loading="addingToCart"
                            class="w-full flex items-center justify-center"
                        />
                        <!-- กรณียังไม่ได้เข้าสู่ระบบ แสดงปุ่มเข้าสู่ระบบ -->
                        <Button v-else icon="pi pi-sign-in" label="เข้าสู่ระบบเพื่อสั่งซื้อ" @click="goToLogin" class="w-full p-button-outlined flex items-center justify-center" />
                    </div>
                </div>
            </div>
        </div>

        <div v-else-if="!loading" class="p-4 text-center">
            <div class="text-gray-500">ไม่พบข้อมูลสินค้า</div>
        </div>
    </Dialog>
</template>

<style scoped>
:deep(.p-dialog-header) {
    padding: 1rem;
    border-bottom: 1px solid #e9ecef;
}

:deep(.p-dialog-content) {
    padding: 0.5rem 1rem 1.5rem 1rem;
}

:deep(.p-galleria) {
    background: transparent;
    border: none;
}

:deep(.p-galleria-thumbnail-container) {
    background-color: rgba(0, 0, 0, 0.03);
    padding: 0.5rem 0;
}

:deep(.p-galleria-thumbnail-item-active) {
    border: 2px solid var(--primary-color) !important;
}

:deep(.p-galleria-thumbnail-item) {
    opacity: 0.7;
    transition: all 0.2s;
}

:deep(.p-galleria-thumbnail-item:hover),
:deep(.p-galleria-thumbnail-item-active) {
    opacity: 1;
}

.overflow-x-auto::-webkit-scrollbar {
    height: 3px;
}

.overflow-x-auto::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.1);
    border-radius: 3px;
}

.cursor-pointer {
    transition: all 0.2s ease;
}

input[type='number']::-webkit-inner-spin-button,
input[type='number']::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
}

/* แก้ไขสไตล์ของ dialog เมื่ออยู่บนมือถือ */
@media (max-width: 640px) {
    :deep(.p-dialog) {
        margin: 0;
        height: 100vh;
        width: 100vw !important;
        max-height: 100vh;
        border-radius: 0;
    }

    :deep(.p-dialog-content) {
        padding-bottom: 5rem;
    }
}
</style>
