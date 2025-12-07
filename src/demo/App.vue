<script setup lang="ts">
import { ref } from 'vue';
import LinterDemo from './LinterDemo.vue';
import VuePopoverDemo from './VuePopoverDemo.vue';
import OnDemandDemo from './OnDemandDemo.vue';

const activeDemo = ref<'ondemand' | 'vue' | 'renderer'>('ondemand');
</script>

<template>
    <div class="app">
        <header class="header">
            <h1>Tiptap Linter Demos</h1>
            <p class="subtitle">
                Explore different ways to customize the popover UI
            </p>
        </header>

        <nav class="nav">
            <button
                :class="['nav-btn', { active: activeDemo === 'ondemand' }]"
                @click="activeDemo = 'ondemand'"
            >
                On-Demand Features
            </button>
            <button
                :class="['nav-btn', { active: activeDemo === 'vue' }]"
                @click="activeDemo = 'vue'"
            >
                Vue Component Popover
            </button>
            <button
                :class="['nav-btn', { active: activeDemo === 'renderer' }]"
                @click="activeDemo = 'renderer'"
            >
                Custom Renderer Popover
            </button>
        </nav>

        <main class="main">
            <OnDemandDemo v-if="activeDemo === 'ondemand'" />
            <VuePopoverDemo v-else-if="activeDemo === 'vue'" />
            <LinterDemo v-else />
        </main>

        <footer class="footer">
            <p>
                Learn more in the
                <a
                    href="https://github.com/Saluana/or3-text-linter/blob/main/docs/vue-components.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    >documentation</a
                >
            </p>
        </footer>
    </div>
</template>

<style scoped>
.app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: #f9fafb;
}

.header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 32px 20px;
    text-align: center;
}

.header h1 {
    margin: 0 0 8px;
    font-size: 32px;
    font-weight: 700;
}

.subtitle {
    margin: 0;
    font-size: 16px;
    opacity: 0.9;
}

.nav {
    background: white;
    padding: 12px 20px;
    display: flex;
    gap: 12px;
    justify-content: center;
    border-bottom: 1px solid #e5e7eb;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.nav-btn {
    padding: 10px 20px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    background: white;
    color: #4b5563;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
}

.nav-btn:hover {
    border-color: #667eea;
    color: #667eea;
}

.nav-btn.active {
    background: #667eea;
    border-color: #667eea;
    color: white;
}

.main {
    flex: 1;
    padding: 20px;
}

.footer {
    background: white;
    padding: 16px 20px;
    text-align: center;
    border-top: 1px solid #e5e7eb;
    color: #6b7280;
    font-size: 14px;
}

.footer a {
    color: #667eea;
    text-decoration: none;
    font-weight: 500;
}

.footer a:hover {
    text-decoration: underline;
}
</style>
