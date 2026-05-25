import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { tip } from "./directives/tip";
import "./style.css";

createApp(App).use(createPinia()).directive("tip", tip).mount("#app");
