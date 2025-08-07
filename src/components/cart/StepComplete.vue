<script setup>
import { ref } from 'vue';

const props = defineProps({
    orderNumber: {
        type: String,
        default: ''
    },
    orderDate: {
        type: String,
        default: ''
    },
    orderTime: {
        type: String,
        default: ''
    }
});

const emit = defineEmits(['go-to-shop']);

// Generate a random order number if not provided
const displayOrderNumber = ref(
    props.orderNumber ||
        `ORD-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}-${Math.floor(Math.random() * 10000)
            .toString()
            .padStart(4, '0')}`
);

// Use provided date and time or generate current ones
const displayOrderDate = ref(
    props.orderDate ||
        new Date().toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
);

const displayOrderTime = ref(
    props.orderTime ||
        new Date().toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit'
        })
);
</script>

<template>
    <div class="flex flex-col items-center justify-center py-8 text-center">
        <div class="w-20 h-20 flex items-center justify-center rounded-full bg-green-100 text-green-500 mb-4">
            <i class="pi pi-check-circle text-4xl"></i>
        </div>

        <h2 class="text-2xl font-bold mb-2">สั่งซื้อสำเร็จ</h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">ขอบคุณสำหรับการสั่งซื้อสินค้ากับเรา</p>

        <div class="w-full max-w-md bg-gray-50 dark:bg-gray-900 p-6 rounded-lg mb-6">
            <div class="text-left mb-4">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-gray-600 dark:text-gray-400">เลขที่คำสั่งซื้อ:</span>
                    <span class="font-bold">{{ displayOrderNumber }}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-600 dark:text-gray-400">วันเวลาที่สั่งซื้อ:</span>
                    <span>{{ displayOrderDate }} {{ displayOrderTime }} น.</span>
                </div>
            </div>

            <div class="bg-white dark:bg-gray-800 p-4 rounded-lg">
                <h3 class="font-bold text-lg mb-3">ข้อมูลเพิ่มเติม</h3>
                <ul class="space-y-2 text-left list-disc pl-5">
                    <li>คุณสามารถตรวจสอบสถานะคำสั่งซื้อได้ที่หน้า "ประวัติการสั่งซื้อ"</li>
                    <li>สำหรับการรับที่ร้าน กรุณาแสดงเลขที่คำสั่งซื้อกับพนักงาน</li>
                    <li>หากมีข้อสงสัยเพิ่มเติม กรุณาติดต่อ 02-1147931 ต่อ 116</li>
                </ul>
            </div>
        </div>

        <Button label="กลับสู่หน้าร้านค้า" icon="pi pi-shopping-bag" @click="emit('go-to-shop')" />
    </div>
</template>
