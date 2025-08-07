<script setup>
import ProductService from '@/services/ProductService';
import { useCartStore } from '@/stores/cartStore';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { computed, watch } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps({
    cartItems: {
        type: Array,
        required: true
    },
    userType: {
        type: String,
        default: ''
    }
});

const emit = defineEmits(['update-item', 'set-cart-changed', 'next-step', 'go-to-shop', 'refresh-cart']);

const confirm = useConfirm();
const toast = useToast();
const router = useRouter();
const cartStore = useCartStore();

// Local references to cart data
const items = computed(() => props.cartItems);

// Calculate totals
const totalAmount = computed(() => items.value.reduce((total, item) => total + parseFloat(item.price) * parseInt(item.qty), 0));
const totalItems = computed(() => items.value.reduce((count, item) => count + parseInt(item.qty), 0));

// Check if item exceeds its stock balance
const isExceedingStock = (item) => {
    // ตรวจสอบว่ามี balance_qty และเป็นค่าที่ใช้งานได้
    if (item.balance_qty !== undefined && item.balance_qty !== null) {
        const balanceQty = parseFloat(item.balance_qty);
        return !isNaN(balanceQty) && parseInt(item.qty) > balanceQty;
    }
    return false;
};

// Check if item is out of stock
const isOutOfStock = (item) => {
    // ตรวจสอบว่ามี balance_qty และเป็นค่าที่ใช้งานได้
    if (item.balance_qty !== undefined && item.balance_qty !== null) {
        const balanceQty = parseFloat(item.balance_qty);
        return !isNaN(balanceQty) && balanceQty <= 0;
    }
    return false;
};

// Get maximum available stock for an item
const getMaxAvailable = (item) => {
    if (item.balance_qty !== undefined && item.balance_qty !== null) {
        const balanceQty = parseFloat(item.balance_qty);
        return !isNaN(balanceQty) ? Math.max(0, balanceQty) : 0;
    }
    return 0;
};

// Watch for cart items changes to adjust quantities if needed
watch(
    items,
    () => {
        items.value.forEach((item) => {
            // ถ้าจำนวนในตะกร้าเกินกว่าสต็อกที่มี ให้ปรับลดจำนวนให้อัตโนมัติ
            if (isExceedingStock(item)) {
                const maxQty = getMaxAvailable(item);
                if (maxQty > 0) {
                    updateItemQuantity(item, maxQty);
                    toast.add({
                        severity: 'info',
                        summary: 'ปรับจำนวนสินค้า',
                        detail: `ปรับจำนวน ${item.item_name} เป็น ${maxQty} ${item.unit_code} ตามสต็อกที่มี`,
                        life: 1500
                    });
                }
            }
        });
    },
    { deep: true, immediate: true }
);

// Handle quantity changes
async function increaseQuantity(item) {
    try {
        // ตรวจสอบก่อนว่าเพิ่มจำนวนแล้วจะเกินสต็อกหรือไม่
        if (item.balance_qty !== undefined && item.balance_qty !== null) {
            const balanceQty = parseFloat(item.balance_qty);
            if (!isNaN(balanceQty) && parseInt(item.qty) + 1 > balanceQty) {
                toast.add({
                    severity: 'warn',
                    summary: 'สต็อกไม่เพียงพอ',
                    detail: `สินค้าคงเหลือในสต็อก ${balanceQty} ${item.unit_code}`,
                    life: 1500
                });
                return;
            }
        }

        // แปลงค่าเป็นตัวเลขก่อนบวก
        const newQty = parseInt(item.qty) + 1;
        item.qty = newQty;
        emit('set-cart-changed');
        await updateItemInCart(item);
    } catch (error) {
        console.error('Error updating quantity:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถเพิ่มจำนวนสินค้าได้',
            life: 1500
        });
        // แปลงค่าเป็นตัวเลขก่อนลบ
        item.qty = parseInt(item.qty) - 1;
    }
}

async function decreaseQuantity(item) {
    // แปลงค่าเป็นตัวเลขก่อนเปรียบเทียบ
    if (parseInt(item.qty) > 1) {
        try {
            // แปลงค่าเป็นตัวเลขก่อนลบ
            const newQty = parseInt(item.qty) - 1;
            item.qty = newQty;
            emit('set-cart-changed');
            await updateItemInCart(item);
        } catch (error) {
            console.error('Error updating quantity:', error);
            toast.add({
                severity: 'error',
                summary: 'เกิดข้อผิดพลาด',
                detail: 'ไม่สามารถลดจำนวนสินค้าได้',
                life: 1500
            });
            // แปลงค่าเป็นตัวเลขก่อนบวก
            item.qty = parseInt(item.qty) + 1;
        }
    }
}

// Update item quantity with specific value
async function updateItemQuantity(item, newQty) {
    try {
        const updatedItem = {
            ...item,
            qty: newQty
        };

        emit('update-item', updatedItem);
        emit('set-cart-changed');
    } catch (error) {
        console.error('Error updating item quantity:', error);
    }
}

// Update item in cart
async function updateItemInCart(item) {
    try {
        // ตรวจสอบให้แน่ใจว่า qty เป็นตัวเลข
        const updatedItem = {
            ...item,
            qty: parseInt(item.qty)
        };

        emit('update-item', updatedItem);
        toast.add({
            severity: 'success',
            summary: 'อัพเดทสินค้า',
            detail: `ปรับจำนวน ${item.item_name} เป็น ${item.qty} ชิ้นแล้ว`,
            life: 1500
        });
    } catch (error) {
        console.error('Error updating cart item:', error);
        throw error;
    }
}

// Remove item from cart
async function removeItem(itemId) {
    try {
        // Remove from cart store
        await cartStore.removeFromCart(itemId);

        // อัพเดต items ตามข้อมูลจาก store โดยตรง
        emit('refresh-cart');

        toast.add({
            severity: 'info',
            summary: 'ลบสินค้า',
            detail: 'ลบสินค้าออกจากตะกร้าแล้ว',
            life: 1500
        });
    } catch (error) {
        console.error('Error removing item:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถลบสินค้าได้',
            life: 1500
        });
    }
}

// Clear cart
async function clearCart() {
    try {
        // Clear cart store
        await cartStore.clearCart();

        // emit event ให้ parent component เรียก fetchCartItems ใหม่
        emit('refresh-cart');

        toast.add({
            severity: 'info',
            summary: 'ล้างตะกร้า',
            detail: 'นำสินค้าทั้งหมดออกจากตะกร้าแล้ว',
            life: 1500
        });
    } catch (error) {
        console.error('Error clearing cart:', error);
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถล้างตะกร้าได้',
            life: 1500
        });
    }
}

// Confirmation dialogs
function confirmRemoveItem(item) {
    confirm.require({
        message: `คุณต้องการลบ ${item.item_name} ออกจากตะกร้าใช่หรือไม่?`,
        header: 'ยืนยันการลบ',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'ใช่, ลบเลย',
        rejectLabel: 'ยกเลิก',
        acceptClass: 'p-button-danger',
        accept: () => removeItem(item.id)
    });
}

function confirmClearCart() {
    confirm.require({
        message: 'คุณต้องการล้างตะกร้าทั้งหมดใช่หรือไม่?',
        header: 'ยืนยันการล้างตะกร้า',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'ใช่, ล้างเลย',
        rejectLabel: 'ยกเลิก',
        acceptClass: 'p-button-danger',
        accept: clearCart
    });
}

// Utility functions
function formatNumber(value) {
    if (value === undefined || value === null) return '0.00';
    const num = parseFloat(value);
    return !isNaN(num)
        ? num.toLocaleString('th-TH', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
          })
        : '0.00';
}

function getProductImage(itemCode) {
    return itemCode ? ProductService.getProductImageUrl(itemCode) : 'https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg';
}

function handleImageError(event) {
    event.target.src = 'https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg';
}

// Navigation
function proceedToCheckout() {
    // Check if any items exceed stock before proceeding
    const stockIssues = items.value.filter((item) => isOutOfStock(item) || isExceedingStock(item));

    if (stockIssues.length > 0) {
        toast.add({
            severity: 'warn',
            summary: 'ปัญหาสต็อกสินค้า',
            detail: 'มีสินค้าบางรายการที่มีปัญหาเกี่ยวกับสต็อก กรุณาตรวจสอบและปรับจำนวนก่อนดำเนินการต่อ',
            life: 5000
        });
        return;
    }

    if (items.value.length === 0) {
        toast.add({
            severity: 'warn',
            summary: 'ตะกร้าว่างเปล่า',
            detail: 'กรุณาเพิ่มสินค้าในตะกร้าก่อนดำเนินการต่อ',
            life: 1500
        });
        return;
    }

    emit('next-step');
}

function validateQuantity(item) {
    // ถ้าค่าว่างเปล่าหรือไม่ใช่ตัวเลข ให้กำหนดเป็น 1
    if (item.qty === '' || isNaN(parseInt(item.qty))) {
        item.qty = 1;
        updateItemInCart(item);
        return;
    }

    // แปลงให้เป็นตัวเลข
    let numValue = parseInt(item.qty);

    // ตรวจสอบว่าไม่ต่ำกว่า 1
    if (numValue < 1) {
        item.qty = 1;
        updateItemInCart(item);
        return;
    }

    // Check if quantity exceeds available stock
    if (item.balance_qty !== undefined && item.balance_qty !== null) {
        const balanceQty = parseFloat(item.balance_qty);
        if (!isNaN(balanceQty) && numValue > balanceQty && balanceQty > 0) {
            numValue = balanceQty;
            toast.add({
                severity: 'info',
                summary: 'ปรับจำนวนสินค้า',
                detail: `ปรับจำนวนเป็น ${numValue} ${item.unit_code} ตามสต็อกที่มี`,
                life: 1500
            });
        }
    }

    // ตัดศูนย์นำหน้า
    item.qty = numValue;

    // อัพเดทสินค้า
    emit('set-cart-changed');
    updateItemInCart(item);
}

// ฟังก์ชันสำหรับจำกัดให้พิมพ์ได้เฉพาะตัวเลข
function handleQuantityKeydown(event) {
    // อนุญาตให้กดปุ่มตัวเลข 0-9 บนคีย์บอร์ดหลักหรือปุ่มตัวเลขด้านข้าง
    const isNumber = /^[0-9]$/.test(event.key);
    // อนุญาตให้กดปุ่ม backspace, delete, tab, arrows
    const isControl = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(event.key);

    if (!isNumber && !isControl) {
        event.preventDefault();
    }
}
</script>

<template>
    <!-- Empty cart -->
    <div v-if="items.length === 0" class="flex flex-col items-center justify-center p-8 text-center">
        <i class="pi pi-shopping-cart text-5xl text-gray-300 dark:text-gray-600 mb-4"></i>
        <h3 class="text-xl font-medium mb-2">ตะกร้าของคุณว่างเปล่า</h3>
        <p class="text-gray-500 dark:text-gray-400 mb-4">เพิ่มสินค้าที่คุณต้องการลงในตะกร้า</p>
        <Button label="เลือกซื้อสินค้า" icon="pi pi-shopping-bag" @click="emit('go-to-shop')" />
    </div>

    <!-- Cart content -->
    <div v-else>
        <h2 class="text-xl font-bold mb-4">รายการสินค้าในตะกร้า</h2>

        <!-- Cart items -->
        <div class="mb-4">
            <div v-for="(item, index) in items" :key="item.id">
                <div :class="['flex items-start gap-3 sm:gap-4', index !== items.length - 1 ? 'border-b border-gray-100 dark:border-gray-700 pb-4 mb-4' : '']">
                    <!-- Product image -->
                    <div class="w-20 h-20 sm:w-24 sm:h-24 overflow-hidden rounded-md flex-shrink-0 border border-gray-200 dark:border-gray-700" @click="router.push(`/products/${item.id}`)">
                        <img :src="getProductImage(item.item_code)" :alt="item.item_code" class="w-full h-full object-contain cursor-pointer" @error="handleImageError" />
                    </div>

                    <!-- Product details -->
                    <div class="flex flex-col flex-grow">
                        <div class="flex justify-between items-start mb-2">
                            <div class="mr-2">
                                <div class="text-base sm:text-lg font-medium hover:text-primary cursor-pointer" @click="router.push(`/products/${item.id}`)">
                                    {{ item.item_code }}
                                </div>
                                <div class="text-base sm:text-lg font-medium hover:text-primary cursor-pointer" @click="router.push(`/products/${item.id}`)">
                                    {{ item.item_name }}
                                </div>
                                <div v-if="item.category" class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">
                                    {{ item.category }}
                                </div>

                                <!-- Stock status warning -->
                                <div v-if="isOutOfStock(item)" class="text-sm text-red-500 mt-1 flex items-center"><i class="pi pi-exclamation-circle mr-1"></i> สินค้าหมด</div>
                                <div v-else-if="isExceedingStock(item)" class="text-sm text-orange-500 mt-1 flex items-center"><i class="pi pi-exclamation-triangle mr-1"></i> เกินจำนวนในสต็อก (คงเหลือ: {{ formatNumber(item.balance_qty) }})</div>
                                <div v-else-if="item.balance_qty !== undefined" class="text-sm text-gray-500 mt-1">คงเหลือในสต็อก: {{ formatNumber(item.balance_qty) }} {{ item.unit_code }}</div>
                            </div>
                            <Button icon="pi pi-trash" severity="danger" text rounded @click="confirmRemoveItem(item)" />
                        </div>

                        <!-- Price and quantity -->
                        <div class="flex justify-between items-end mt-auto">
                            <div class="flex items-center">
                                <Button icon="pi pi-minus" text rounded class="p-button-sm border border-gray-200 dark:border-gray-700" @click="decreaseQuantity(item)" :disabled="parseInt(item.qty) <= 1" />

                                <!-- แทนที่ span ด้วย input -->
                                <input
                                    type="text"
                                    v-model="item.qty"
                                    class="mx-2 text-center w-10 text-base border-0 focus:outline-none focus:ring-0 bg-transparent"
                                    @blur="validateQuantity(item)"
                                    @keydown="handleQuantityKeydown($event)"
                                    :class="{ 'text-red-500': isOutOfStock(item) || isExceedingStock(item) }"
                                />

                                <Button
                                    icon="pi pi-plus"
                                    text
                                    rounded
                                    class="p-button-sm border border-gray-200 dark:border-gray-700"
                                    @click="increaseQuantity(item)"
                                    :disabled="isOutOfStock(item) || (item.balance_qty !== undefined && parseInt(item.qty) >= parseFloat(item.balance_qty))"
                                />
                            </div>
                            <div class="flex flex-col items-end">
                                <span class="text-lg sm:text-xl font-bold">฿{{ formatNumber(item.price * item.qty) }}</span>
                                <span class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">฿{{ formatNumber(item.price) }} / {{ item.unit_code }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Actions -->
        <div class="flex justify-between items-center py-4 border-t border-gray-100 dark:border-gray-700">
            <Button icon="pi pi-trash" label="ล้างตะกร้า" severity="secondary" text @click="confirmClearCart" />

            <div class="flex flex-col items-end">
                <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">{{ totalItems }} สินค้าในตะกร้า</div>
                <div class="text-xl font-bold">รวม: ฿{{ formatNumber(totalAmount) }}</div>
            </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-between mt-4">
            <Button label="เลือกซื้อสินค้าต่อ" icon="pi pi-arrow-left" outlined @click="emit('go-to-shop')" />
            <Button label="ดำเนินการต่อ" icon="pi pi-arrow-right" iconPos="right" @click="proceedToCheckout" />
        </div>
    </div>
</template>
