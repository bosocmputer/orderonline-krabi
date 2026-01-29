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
    },
    groupMain: {
        type: String,
        default: ''
    }
});

const emit = defineEmits(['update:visible', 'added-to-cart', 'favorite-changed']);

const router = useRouter();
const product = ref(null);
const images = ref([]);
const loading = ref(true);
const loadingStock = ref(false);
const addingToCart = ref(false);
const toast = useToast();
const cartStore = useCartStore();
const selectedUnitIndex = ref(0);
const shareOverlay = ref(null);

const authenStore = useAuthenStore();
const isLoggedIn = computed(() => authenStore.isAuthenticated);

// ข้อมูลสต็อกตาม location (ปียาง)
const stockLocations = ref([]);
// จำนวนที่จะสั่งซื้อแต่ละ location { location: quantity }
const locationQuantities = ref({});
// คลังที่เลือก
const selectedWarehouse = ref('');

// ดึงคลังที่เลือกจาก localStorage
function getSelectedWarehouse() {
    try {
        const warehouseData = localStorage.getItem('_selectedWarehouse');
        if (warehouseData) {
            const parsed = JSON.parse(warehouseData);
            return parsed.code || '';
        }
    } catch (err) {
        console.error('Error parsing warehouse data:', err);
    }
    return '';
}

// ตรวจสอบว่า location นั้นสามารถสั่งได้หรือไม่ (อยู่ในคลังที่เลือก)
function isLocationOrderable(loc) {
    return loc.warehouse === selectedWarehouse.value;
}

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
        breakpoint: '1024px',
        numVisible: 4
    },
    {
        breakpoint: '768px',
        numVisible: 3
    },
    {
        breakpoint: '576px',
        numVisible: 2
    },
    {
        breakpoint: '480px',
        numVisible: 2
    }
]);

// ตรวจสอบว่าสินค้านี้อยู่ในตะกร้าหรือไม่ (ตาม item_code + unit_code ที่เลือก)
const isInCart = computed(() => {
    if (!product.value || !currentUnit.value) return false;
    const productCode = product.value.id || product.value.code;
    const unitCode = currentUnit.value.unit_code;
    return cartStore.cartItems.some((item) => item.item_code === productCode && item.unit_code === unitCode);
});

// จำนวนที่มีในตะกร้า (รวมทุก location ของ item_code + unit_code ที่เลือก)
const quantityInCart = computed(() => {
    if (!product.value || !currentUnit.value) return 0;
    const productCode = product.value.id || product.value.code;
    const unitCode = currentUnit.value.unit_code;
    // รวมจำนวนจากทุก location ที่มี item_code และ unit_code เดียวกัน
    return cartStore.cartItems.filter((item) => item.item_code === productCode && item.unit_code === unitCode).reduce((total, item) => total + parseInt(item.qty || 0), 0);
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

// คำนวณยอดรวมคงเหลือจากทุก location
const totalStockBalance = computed(() => {
    return stockLocations.value.reduce((sum, loc) => sum + parseFloat(loc.balance_qty || 0), 0);
});

// คำนวณจำนวนรวมที่สั่งจากทุก location
const totalOrderQuantity = computed(() => {
    return Object.values(locationQuantities.value).reduce((sum, qty) => sum + (parseInt(qty) || 0), 0);
});

// คำนวณราคารวมของสินค้าที่เลือกทั้งหมด
const totalOrderPrice = computed(() => {
    let total = 0;
    for (const [location, qty] of Object.entries(locationQuantities.value)) {
        if (qty > 0) {
            const loc = stockLocations.value.find((l) => l.location.toString() === location.toString());
            const price = parseFloat(loc?.price || 0);
            total += price * parseInt(qty);
        }
    }
    return total;
});

// ตรวจสอบว่าสินค้าหมด (ไม่มี location หรือ stock = 0)
const isOutOfStock = computed(() => {
    return stockLocations.value.length === 0 || totalStockBalance.value <= 0;
});

// ตรวจสอบว่าสามารถเพิ่มลงตะกร้าได้หรือไม่
const canAddToCart = computed(() => {
    return totalOrderQuantity.value > 0 && !isOutOfStock.value;
});

// ตรวจสอบเมื่อ Dialog เปิดและมี itemCode หรือเมื่อ itemCode เปลี่ยน
watch([() => props.visible, () => props.itemCode], ([newVisible, newItemCode], [oldVisible, oldItemCode]) => {
    if (newVisible && newItemCode && ((!oldVisible && newVisible) || (newVisible && newItemCode !== oldItemCode))) {
        // console.log('Fetching product detail for:', newItemCode);
        // รีเซ็ตค่าต่างๆ เมื่อโหลดข้อมูลใหม่
        product.value = null;
        images.value = [];
        selectedUnitIndex.value = 0;
        stockLocations.value = [];
        locationQuantities.value = {};
        loading.value = true;

        // โหลดข้อมูลสินค้า
        fetchProductDetail();
    }
});

onMounted(() => {
    // หากมี itemCode และ visible = true ตั้งแต่เริ่มต้น ให้โหลดข้อมูล
    if (props.visible && props.itemCode) {
        console.log('Initial fetch on mount for:', props.itemCode);
        fetchProductDetail();
    }
});

// ฟังก์ชันดึงข้อมูลสต็อกตาม location
async function fetchProductStock() {
    if (!product.value || !product.value.code || !currentUnit.value) return;

    loadingStock.value = true;
    // ดึงคลังที่เลือกจาก localStorage
    selectedWarehouse.value = getSelectedWarehouse();

    try {
        const result = await ProductService.getProductStock(product.value.code, currentUnit.value.unit_code);

        if (result.data && result.data.length > 0) {
            // เรียงลำดับให้ warehouse ที่ตรงกับที่เลือกขึ้นก่อน
            const sortedData = [...result.data].sort((a, b) => {
                const aMatch = a.warehouse === selectedWarehouse.value ? 0 : 1;
                const bMatch = b.warehouse === selectedWarehouse.value ? 0 : 1;
                return aMatch - bMatch;
            });

            stockLocations.value = sortedData;
            // รีเซ็ตจำนวนสั่งซื้อแต่ละ location เป็น 0
            locationQuantities.value = {};
            sortedData.forEach((loc) => {
                locationQuantities.value[loc.location] = 0;
            });
        } else {
            stockLocations.value = [];
            locationQuantities.value = {};
        }
    } catch (error) {
        console.error('Error fetching product stock:', error);
        stockLocations.value = [];
        locationQuantities.value = {};
    } finally {
        loadingStock.value = false;
    }
}

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
        product.value = null;
        loading.value = false;
        return;
    }

    loading.value = true;
    try {
        const result = await ProductService.getProductByItemCode(props.itemCode);

        if (result.data) {
            if (result.data.balance_qty === '0' || parseFloat(result.data.balance_qty) === 0) {
                result.data.sold_out = '1';
            }

            if (result.data.otherUnits && result.data.otherUnits.length > 0) {
                result.data.otherUnits.forEach((unit) => {
                    if (unit.balance_qty === '0' || parseFloat(unit.balance_qty) === 0) {
                        unit.sold_out = '1';
                    }
                });
            }
        }

        product.value = result.data;

        // ดึงรายการรูปภาพสำหรับแกลลอรี่
        await fetchProductImages();

        // ดึงข้อมูลสต็อกตาม location
        await fetchProductStock();
    } catch (error) {
        console.error('Error fetching product detail:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถโหลดข้อมูลสินค้าได้',
            life: 3000
        });
        product.value = null;
    } finally {
        loading.value = false;
    }
}

// ดึงรายการรูปภาพของสินค้า
async function fetchProductImages() {
    if (!product.value || !product.value.code) {
        images.value = [
            {
                itemImageSrc: ProductService.getPlaceholderImage(),
                thumbnailImageSrc: ProductService.getPlaceholderImage(),
                alt: product.value ? product.value.name : 'สินค้า'
            }
        ];
        return;
    }

    try {
        const imageList = await ProductService.getImageList(product.value.code);

        if (imageList && imageList.length > 0) {
            images.value = imageList.map((imageData) => ({
                itemImageSrc: ProductService.getProductImageByGuid(imageData.guid_code),
                thumbnailImageSrc: ProductService.getProductImageByGuid(imageData.guid_code),
                alt: product.value.name,
                guid_code: imageData.guid_code
            }));
        } else {
            images.value = [
                {
                    itemImageSrc: ProductService.getPlaceholderImage(),
                    thumbnailImageSrc: ProductService.getPlaceholderImage(),
                    alt: product.value.name
                }
            ];
        }
    } catch (error) {
        console.error('Error fetching product images:', error);
        images.value = [
            {
                itemImageSrc: ProductService.getPlaceholderImage(),
                thumbnailImageSrc: ProductService.getPlaceholderImage(),
                alt: product.value.name
            }
        ];
    }
}

// แสดง overlay สำหรับแชร์
function toggleShareMenu(event) {
    shareOverlay.value.toggle(event);
}

function shareToFacebook() {
    if (!product.value) return;

    const baseUrl = window.location.origin;
    const productPath = `/product/${product.value.code}`;
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(baseUrl + productPath)}`;

    window.open(shareUrl, '_blank', 'width=600,height=400');
    shareOverlay.value.hide();
}

function shareToLine() {
    if (!product.value) return;

    const baseUrl = window.location.origin;
    const productPath = `/product/${product.value.code}`;
    const shareUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(baseUrl + productPath)}`;

    window.open(shareUrl, '_blank', 'width=600,height=600');
    shareOverlay.value.hide();
}

function copyLink() {
    if (!product.value) return;

    const baseUrl = window.location.origin;
    const productPath = `/product-detail/${product.value.code}`;
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

// เพิ่มจำนวนสินค้าตาม location
function incrementLocationQuantity(location) {
    const loc = stockLocations.value.find((l) => l.location === location);
    const warehouse = localStorage.getItem('_selectedWarehouse') ? JSON.parse(localStorage.getItem('_selectedWarehouse')).code : '';
    if (!loc) return;

    const maxQty = parseInt(loc.balance_qty) || 0;
    const currentQty = locationQuantities.value[location] || 0;

    // ตรวจสอบจำนวนในตะกร้าของ location เดียวกัน
    const inCartQty = getLocationQuantityInCart(location, warehouse);
    const remainingStock = maxQty - inCartQty;

    if (currentQty < remainingStock) {
        locationQuantities.value[location] = currentQty + 1;
    } else {
        toast.add({
            severity: 'info',
            summary: 'ข้อมูลสต็อก',
            detail: `ปียาง ${location} มีคงเหลือ ${maxQty} ${currentUnit.value?.unit_code || ''} (อยู่ในตะกร้าแล้ว ${inCartQty})`,
            life: 3000
        });
    }
}

// ลดจำนวนสินค้าตาม location
function decrementLocationQuantity(location) {
    const currentQty = locationQuantities.value[location] || 0;
    if (currentQty > 0) {
        locationQuantities.value[location] = currentQty - 1;
    }
}

// ดึงจำนวนที่มีในตะกร้าของ location นั้นๆ (รวมเงื่อนไขคลังด้วย)
function getLocationQuantityInCart(location, warehouse) {
    if (!product.value || !currentUnit.value) return 0;

    // console.log('cartStore.cartItems :', cartStore.cartItems);
    // console.log('warehouse :', warehouse, ' location :', location);
    const cartItem = cartStore.cartItems.find((item) => item.item_code === (product.value.id || product.value.code) && item.unit_code === currentUnit.value.unit_code && item.shelf_code === location && item.wh_code === warehouse);
    return cartItem ? parseInt(cartItem.qty) : 0;
}

// คำนวณจำนวนที่สามารถเพิ่มได้อีกของแต่ละ location
function getRemainingStockForLocation(location) {
    const loc = stockLocations.value.find((l) => l.location === location);
    const warehouse = localStorage.getItem('_selectedWarehouse') ? JSON.parse(localStorage.getItem('_selectedWarehouse')).code : '';
    if (!loc) return 0;

    const maxQty = parseInt(loc.balance_qty) || 0;
    const inCartQty = getLocationQuantityInCart(location, warehouse);
    return Math.max(0, maxQty - inCartQty);
}

// ตรวจสอบว่า location นั้นสามารถเพิ่มได้อีกหรือไม่
function canIncrementLocation(location) {
    const currentQty = locationQuantities.value[location] || 0;
    const remainingStock = getRemainingStockForLocation(location);
    return currentQty < remainingStock;
}

function addToCart() {
    if (!product.value || !canAddToCart.value) return;

    const unit = currentUnit.value;
    addingToCart.value = true;

    // รวบรวมรายการสินค้าทั้งหมดเป็น array เดียว
    const cartItems = [];

    // console.log('locationQuantities', locationQuantities.value);
    // console.log('stockLocations', stockLocations.value);

    for (const [location, qty] of Object.entries(locationQuantities.value)) {
        if (qty > 0) {
            const loc = stockLocations.value.find((l) => l.location.toString() === location.toString());
            // console.log('loc', loc);

            const cartItem = {
                id: `${product.value.code}_${unit.unit_code}_${location}`,
                item_code: product.value.code,
                code: product.value.code,
                name: product.value.name,
                item_name: product.value.name,
                price: parseFloat(loc?.price || unit.price) || 0,
                image: product.value.image,
                category: product.value.category || '',
                unit: unit.unit_code,
                unit_code: unit.unit_code,
                barcode: product.value.barcode || '',
                wh_code: loc?.warehouse || localStorage.getItem('_warehouseCode') || '',
                shelf_code: location, // ใช้ location เป็น shelf_code (ปียาง)
                location_name: loc?.location_name || location
            };
            // console.log('cartItem', cartItem);
            // ตรวจสอบว่ามีสินค้านี้ในตะกร้าแล้วหรือไม่

            // console.log('cartStore.cartItems', cartStore.cartItems);
            const existingCartItem = cartStore.cartItems.find((item) => item.item_code === cartItem.item_code && item.unit_code === cartItem.unit_code && item.shelf_code === cartItem.shelf_code);
            // console.log('existingCartItem', existingCartItem);
            let finalQty = qty;
            if (existingCartItem) {
                finalQty = parseInt(existingCartItem.qty) + qty;
            }
            // console.log('finalQty', finalQty);
            cartItems.push({ ...cartItem, qty: finalQty });
        }
    }

    // console.log('Adding to cart items:', cartItems);

    // ส่งรายการสินค้าทั้งหมดไป API ครั้งเดียว
    cartStore
        .addMultipleToCart(cartItems)
        .then(() => {
            emit('added-to-cart', { itemCode: product.value.code, totalQty: totalOrderQuantity.value });

            // รีเซ็ตจำนวนหลังเพิ่มลงตะกร้า
            Object.keys(locationQuantities.value).forEach((loc) => {
                locationQuantities.value[loc] = 0;
            });

            // toast.add({
            //     severity: 'success',
            //     summary: 'เพิ่มสินค้าแล้ว',
            //     detail: `เพิ่ม ${product.value.name} ลงในตะกร้าแล้ว`,
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
async function changeUnit(index) {
    selectedUnitIndex.value = index;
    // รีเซ็ตข้อมูลสต็อกและจำนวนเมื่อเปลี่ยนหน่วย
    stockLocations.value = [];
    locationQuantities.value = {};

    // ดึงข้อมูลสต็อกใหม่ตามหน่วยที่เลือก
    await fetchProductStock();
}

// ฟังก์ชันเปลี่ยนสถานะรายการโปรด
function toggleFavorite() {
    if (!product.value) return;

    const oldFavoriteStatus = product.value.favorite_item || '0';
    product.value.favorite_item = product.value.favorite_item === '1' ? '0' : '1';

    emit('favorite-changed', {
        itemCode: product.value.id || product.value.code,
        isFavorite: product.value.favorite_item === '1'
    });

    ProductService.updateFavoriteStatus(product.value.id || product.value.code, product.value.favorite_item).catch((error) => {
        console.error('Error updating favorite status:', error);
        product.value.favorite_item = oldFavoriteStatus;

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

function handleQuantityKeydown(event) {
    const isNumber = /^[0-9]$/.test(event.key);
    const isControl = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(event.key);

    if (!isNumber && !isControl) {
        event.preventDefault();
    }
}

function validateLocationQuantity(location) {
    let qty = parseInt(locationQuantities.value[location]) || 0;

    if (qty < 0) qty = 0;

    const remainingStock = getRemainingStockForLocation(location);
    if (qty > remainingStock) {
        qty = remainingStock;
        toast.add({
            severity: 'info',
            summary: 'ข้อมูลสต็อก',
            detail: `สามารถสั่งได้สูงสุด ${remainingStock} ${currentUnit.value?.unit_code || ''} สำหรับปียาง ${location}`,
            life: 3000
        });
    }

    locationQuantities.value[location] = qty;
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
        :draggable="false"
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
                    <Galleria
                        v-if="images.length > 0"
                        :value="images"
                        :numVisible="4"
                        :circular="true"
                        :showThumbnails="images.length > 1"
                        :showItemNavigators="images.length > 1"
                        :responsiveOptions="galleryOptions"
                        :thumbnailsPosition="images.length <= 4 ? 'bottom' : 'bottom'"
                        containerClass="w-full galleria-custom"
                    >
                        <template #item="slotProps">
                            <div class="flex justify-center items-center bg-gray-50 dark:bg-gray-800 rounded-lg" style="height: 320px">
                                <img :src="slotProps.item.itemImageSrc" :alt="slotProps.item.alt" @error="$event.target.src = ProductService.getPlaceholderImage()" class="max-w-full max-h-full object-contain rounded-lg" style="max-height: 300px" />
                            </div>
                        </template>
                        <template #thumbnail="slotProps">
                            <div class="thumbnail-wrapper">
                                <img :src="slotProps.item.thumbnailImageSrc" :alt="slotProps.item.alt" @error="$event.target.src = ProductService.getPlaceholderImage()" class="thumbnail-image" />
                            </div>
                        </template>
                    </Galleria>

                    <!-- ถ้าไม่มีรูปภาพ ให้แสดงรูปภาพสำรอง -->
                    <div v-else class="w-full h-[300px] flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                        <img :src="ProductService.getPlaceholderImage()" :alt="product ? product.name : 'สินค้า'" class="max-h-[250px] max-w-full object-contain" />
                    </div>

                    <!-- Tags positioned on the gallery -->
                    <div class="absolute top-3 left-3 flex flex-col gap-2">
                        <Tag :value="isOutOfStock ? 'สินค้าหมด' : 'มีสินค้า'" :severity="isOutOfStock ? 'danger' : 'success'" class="text-xs sm:text-sm" />
                    </div>
                </div>

                <!-- Product info -->
                <div class="product-info">
                    <div class="mb-3">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                            <div class="text-sm sm:text-base text-gray-500 dark:text-gray-400">
                                รหัสสินค้า: <span class="font-medium">{{ product.code }}</span>
                            </div>
                        </div>
                    </div>

                    <Divider />

                    <!-- ถ้ามีหลายหน่วยให้แสดงตัวเลือกหน่วย -->
                    <div class="mb-4">
                        <div class="text-base font-medium mb-2">เลือกหน่วย:</div>
                        <div class="flex flex-wrap gap-2">
                            <!-- ปุ่มเลือกหน่วยหลัก -->
                            <Button :label="product.unit_code" :outlined="selectedUnitIndex !== 0" @click="changeUnit(0)" class="text-md" />

                            <!-- ปุ่มเลือกหน่วยอื่นๆ -->
                            <Button v-for="(unitItem, idx) in product.otherUnits" :key="idx" :label="unitItem.unit_code" :outlined="selectedUnitIndex !== idx + 1" @click="changeUnit(idx + 1)" class="text-sm" size="small" />
                        </div>
                    </div>

                    <!-- แสดงข้อความสินค้าหมด (ไม่แสดงขณะกำลังโหลด) -->
                    <div v-if="isOutOfStock && !loadingStock" class="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 p-3 rounded-lg text-base mb-4 flex items-center">
                        <i class="pi pi-exclamation-triangle mr-2"></i>
                        <span>สินค้าหมด ไม่สามารถสั่งซื้อได้</span>
                    </div>
                    <!-- Loading stock -->
                    <div v-if="loadingStock" class="flex flex-col justify-center items-center p-6 bg-gray-50 dark:bg-gray-800/30 rounded-lg">
                        <ProgressSpinner style="width: 40px; height: 40px" />
                        <span class="mt-3 text-gray-500 dark:text-gray-400">กำลังโหลดข้อมูลสต็อก...</span>
                    </div>

                    <!-- Price section -->
                    <!-- <div class="flex items-center mb-4 mt-3" v-if="currentUnit">

                        <template v-if="isLoggedIn">
                            <span class="text-2xl sm:text-3xl font-bold text-primary"> ฿{{ parseFloat(currentUnit.price == '' ? 0 : currentUnit.price).toLocaleString() }} </span>
                            <span class="text-base text-gray-500 ml-2"> / {{ currentUnit.unit_code }} </span>
                        </template>


                        <template v-else>
                            <div class="bg-gray-50 dark:bg-gray-800/30 p-3 rounded-lg w-full text-center">
                                <i class="pi pi-lock mr-2"></i>
                                <span class="text-base">กรุณาเข้าสู่ระบบเพื่อดูราคา</span>
                                <Button icon="pi pi-sign-in" label="เข้าสู่ระบบ" @click="goToLogin" class="mt-2 ml-2 p-button-sm" size="small" />
                            </div>
                        </template>
                    </div> -->

                    <!-- In cart badge -->
                    <div v-if="isInCart" class="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 p-3 rounded-lg text-base mb-4 flex items-center">
                        <i class="pi pi-info-circle mr-2"></i>
                        <span>มีในตะกร้าแล้ว <Badge :value="quantityInCart" severity="info" class="ml-1"></Badge></span>
                    </div>

                    <!-- Stock locations table (ปียาง) -->
                    <div class="mb-4" v-if="isLoggedIn && !isOutOfStock">
                        <div class="text-base font-medium mb-2">{{ groupMain == 'G001' || groupMain == 'G003' ? 'เลือกจำนวนตามปียาง:' : 'เลือกจำนวน:' }}</div>

                        <!-- Stock table -->
                        <div class="bg-gray-50 dark:bg-gray-800/30 rounded-lg overflow-hidden">
                            <!-- Header -->
                            <div class="grid grid-cols-4 gap-2 p-3 bg-gray-100 dark:bg-gray-700 font-medium text-sm">
                                <div class="text-center">คงเหลือ</div>
                                <div class="text-center">จำนวนสั่ง</div>
                                <div class="text-center">{{ groupMain == 'G001' || groupMain == 'G003' ? 'ปียาง' : 'ที่เก็บ' }}</div>
                                <div class="text-center">ราคา</div>
                            </div>
                            <!-- Rows -->
                            <div
                                v-for="(loc, index) in stockLocations"
                                :key="loc.location"
                                :class="['grid grid-cols-4 gap-2 p-3 items-center', index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/50', !isLocationOrderable(loc) ? 'opacity-60' : '']"
                            >
                                <!-- คลัง -->
                                <!-- <div class="text-center">
                                    <span :class="['font-medium text-xs', isLocationOrderable(loc) ? 'text-green-600' : 'text-gray-500']">
                                        {{ loc.warehouse }}
                                    </span>
                                </div> -->

                                <!-- คงเหลือ -->
                                <div class="text-center">
                                    <span class="font-medium">{{ parseInt(loc.balance_qty) }}</span>

                                    <div v-if="getLocationQuantityInCart(loc.location, loc.warehouse) > 0" class="text-xs text-blue-500">ในตะกร้า: {{ getLocationQuantityInCart(loc.location, loc.warehouse) }}</div>
                                </div>

                                <!-- จำนวนสั่ง - แสดงเฉพาะ warehouse ที่เลือก -->
                                <div class="flex items-center justify-center gap-1">
                                    <template v-if="isLocationOrderable(loc)">
                                        <Button
                                            icon="pi pi-minus"
                                            text
                                            rounded
                                            size="small"
                                            @click="decrementLocationQuantity(loc.location)"
                                            :disabled="(locationQuantities[loc.location] || 0) <= 0"
                                            class="w-8 h-8 border border-gray-300 dark:border-gray-600"
                                        />
                                        <input
                                            type="text"
                                            v-model="locationQuantities[loc.location]"
                                            class="w-12 text-center font-medium border border-gray-300 dark:border-gray-600 rounded px-1 py-1 bg-white dark:bg-gray-700"
                                            @blur="validateLocationQuantity(loc.location)"
                                            @keydown="handleQuantityKeydown"
                                        />
                                        <Button
                                            icon="pi pi-plus"
                                            text
                                            rounded
                                            size="small"
                                            @click="incrementLocationQuantity(loc.location)"
                                            :disabled="!canIncrementLocation(loc.location)"
                                            class="w-8 h-8 border border-gray-300 dark:border-gray-600"
                                        />
                                    </template>
                                    <template v-else>
                                        <span class="text-gray-400 text-xs">-</span>
                                    </template>
                                </div>
                                <!-- ปียาง -->
                                <div class="text-center">
                                     <span :class="['font-medium text-xs', isLocationOrderable(loc) ? 'text-green-600' : 'text-gray-500']">
                                        {{ loc.warehouse }} || {{ loc.location }}
                                    </span>

                                </div>

                                <!-- ราคา -->
                                <div class="text-center">
                                    <span class="font-medium text-green-600">฿{{ parseFloat(loc.price || 0).toLocaleString() }}</span>
                                </div>
                            </div>

                            <!-- Total -->
                            <div class="grid grid-cols-4 gap-2 p-3 bg-gray-100 dark:bg-gray-700 font-medium border-t">

                                <div class="text-center">รวม: {{ totalStockBalance }}</div>
                                <div class="text-center text-primary">สั่ง: {{ totalOrderQuantity }}</div>
                                <div></div>
                                <div class="text-center text-green-600">฿{{ formatNumber(totalOrderPrice) }}</div>
                            </div>
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

                    <!-- Action Buttons -->
                    <div class="gap-3 mt-4">
                        <!-- กรณีเข้าสู่ระบบแล้ว แสดงปุ่มเพิ่มลงตะกร้า -->
                        <Button
                            v-if="isLoggedIn"
                            icon="pi pi-shopping-cart"
                            :label="`เพิ่มลงตะกร้า${totalOrderQuantity > 0 ? ' (' + totalOrderQuantity + ')' : ''}`"
                            @click="addToCart"
                            :disabled="!canAddToCart"
                            :loading="addingToCart"
                            class="w-full flex items-center justify-center"
                        />
                        <!-- กรณียังไม่ได้เข้าสู่ระบบ แสดงปุ่มเข้าสู่ระบบ -->
                        <Button v-else icon="pi pi-sign-in" label="เข้าสู่ระบบเพื่อสั่งซื้อ" @click="goToLogin" class="w-full p-button-outlined flex items-center justify-center" />
                    </div>
                </div>
            </div>
        </div>

        <div v-else-if="!loading" class="p-6 text-center">
            <div class="flex flex-col items-center justify-center" style="min-height: 300px">
                <i class="pi pi-exclamation-triangle text-6xl text-gray-400 dark:text-gray-600 mb-4"></i>
                <h3 class="text-xl font-medium text-gray-700 dark:text-gray-300 mb-2">ไม่พบข้อมูลสินค้า</h3>
                <p class="text-gray-500 dark:text-gray-400 mb-4">ขออภัย ไม่สามารถโหลดข้อมูลสินค้าได้ในขณะนี้</p>
                <Button label="ปิด" icon="pi pi-times" outlined @click="closeDialog" />
            </div>
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
    background-color: transparent;
    padding: 0.75rem 0 0 0;
}

:deep(.p-galleria-thumbnail-item) {
    opacity: 0.7;
    transition: all 0.3s ease;
    margin: 0.25rem;
    border-radius: 8px;
    overflow: hidden;
    border: 2px solid transparent;
}

:deep(.p-galleria-thumbnail-item:hover) {
    opacity: 0.9;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

:deep(.p-galleria-thumbnail-item-active) {
    opacity: 1 !important;
    border: 2px solid var(--primary-color) !important;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

:deep(.p-galleria-item-nav) {
    background: rgba(255, 255, 255, 0.9);
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    margin: 0 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    transition: all 0.2s ease;
}

:deep(.p-galleria-item-nav:hover) {
    background: rgba(255, 255, 255, 1);
    transform: scale(1.1);
}

:deep(.p-galleria-item-nav .p-galleria-item-nav-icon) {
    font-size: 1rem;
    color: #666;
}

.thumbnail-wrapper {
    width: 80px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f8f9fa;
    border-radius: 6px;
    overflow: hidden;
    transition: all 0.2s ease;
}

.thumbnail-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.2s ease;
}

.galleria-custom :deep(.p-galleria-thumbnail-item:hover) .thumbnail-wrapper {
    background: #e9ecef;
}

.galleria-custom :deep(.p-galleria-thumbnail-item:hover) .thumbnail-image {
    transform: scale(1.05);
}

.p-galleria-thumbnail-items {
    padding-top: 1px;
}

/* Responsive thumbnail sizes */
@media (max-width: 768px) {
    .thumbnail-wrapper {
        width: 60px;
        height: 45px;
    }

    :deep(.p-galleria-thumbnail-item) {
        margin: 0 0.125rem;
    }
}

@media (max-width: 480px) {
    .thumbnail-wrapper {
        width: 50px;
        height: 38px;
    }

    :deep(.p-galleria-thumbnail-container) {
        padding: 0.5rem 0 0 0;
    }
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
```
