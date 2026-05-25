<template>
  <div class="boot">
    <div class="boot__beam" />
    <div class="boot__content">
      <div class="boot__title mono">GENETIQ</div>
      <div class="boot__sub mono">GENOME RECONSTRUCTION INTERFACE</div>
      <div class="boot__status mono">▮ INITIALISING SUBSYSTEMS…</div>
    </div>
  </div>
</template>

<style scoped>
.boot {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* CRT power-on: a bright line snaps open into the frame. */
.boot__beam {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 2px;
  background: var(--accent, #8fe3ff);
  box-shadow: 0 0 24px 4px var(--accent, #8fe3ff);
  animation: beam 0.7s ease-out forwards;
}

@keyframes beam {
  0% {
    transform: scaleX(0);
    opacity: 1;
  }
  60% {
    transform: scaleX(1);
    opacity: 1;
  }
  100% {
    transform: scaleX(1) scaleY(220);
    opacity: 0;
  }
}

.boot__content {
  text-align: center;
  color: var(--accent, #8fe3ff);
  opacity: 0;
  animation: reveal 1.5s ease-out 0.5s forwards;
  text-shadow: 0 0 8px rgba(143, 227, 255, 0.6);
}

@keyframes reveal {
  0% {
    opacity: 0;
  }
  20% {
    opacity: 1;
  }
  40% {
    opacity: 0.6;
  }
  55% {
    opacity: 1;
  }
  100% {
    opacity: 1;
  }
}

.boot__title {
  font-family: var(--font-display);
  font-size: 34px;
  letter-spacing: 0.4em;
  padding-left: 0.4em;
}

.boot__sub {
  font-size: 12px;
  letter-spacing: 0.3em;
  color: var(--accent-dim, #84b4ea);
  margin-top: 8px;
}

.boot__status {
  font-size: 11px;
  letter-spacing: 0.2em;
  color: var(--muted, #5f86b8);
  margin-top: 22px;
  animation: blink 0.8s steps(2) infinite;
}

@keyframes blink {
  50% {
    opacity: 0.3;
  }
}
</style>
