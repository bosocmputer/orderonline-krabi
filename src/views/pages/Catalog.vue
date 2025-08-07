<script setup>
import { ref } from 'vue';

// นำเข้า Component ที่แยกออกมา
import CategorySelection from '@/components/catalog/CategorySelection.vue';
import ProductList from '@/components/catalog/ProductList.vue';
import RecommendedProducts from '@/components/catalog/RecommendedProducts.vue';

// ข้อมูลหมวดหมู่
const selectedCategory = ref('all');

// เลือกหมวดหมู่
function handleSelectCategory(categoryCode) {
    selectedCategory.value = categoryCode;
}
</script>

<template>
    <Toast />
    <div class="flex justify-center bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div class="w-full max-w-full md:max-w-4xl lg:max-w-full overflow-y-auto">
            <!-- 1. ส่วนสินค้าแนะนำ -->
            <RecommendedProducts />

            <!-- ส่วนหัวแคตตาล็อก -->
            <header class="sticky top-0 bg-white dark:bg-gray-800 z-20 shadow-sm">
                <!-- 2. ส่วนแสดงหมวดหมู่ -->
                <CategorySelection :selectedCategory="selectedCategory" @select-category="handleSelectCategory" />

                <!-- 3. ส่วนค้นหาและแสดงรายการสินค้า -->
                <ProductList :selectedCategory="selectedCategory" />
            </header>
        </div>
    </div>
</template>
