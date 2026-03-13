const vaultHitboxes = document.querySelectorAll(".vault-hitbox");
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const DEFAULT_MAX_TILT_DEGREES = 0;
const DEFAULT_HOVER_SCALE = 1;
const DEFAULT_HOVER_LIFT = 0;
const HOVER_BOUNDS_SAFETY_PX = 4;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getNumericCSSVariable(element, propertyName, fallbackValue) {
  const parsedValue = parseFloat(
    getComputedStyle(element).getPropertyValue(propertyName)
  );

  return Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
}

function getVaultMotionConfig(vault) {
  return {
    hoverScale: getNumericCSSVariable(
      vault,
      "--vault-hover-scale",
      DEFAULT_HOVER_SCALE
    ),
    hoverLift: getNumericCSSVariable(
      vault,
      "--vault-hover-lift",
      DEFAULT_HOVER_LIFT
    ),
    maxTilt: getNumericCSSVariable(
      vault,
      "--vault-tilt-max",
      DEFAULT_MAX_TILT_DEGREES
    ),
  };
}

function setVaultTilt(vault, rect, event, maxTilt) {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const distanceX = event.clientX - centerX;
  const distanceY = event.clientY - centerY;
  const normalizedX = clamp(distanceX / (rect.width / 2), -1, 1);
  const normalizedY = clamp(distanceY / (rect.height / 2), -1, 1);
  const rotateY = normalizedX * maxTilt;
  const rotateX = -normalizedY * maxTilt;

  vault.style.setProperty("--vault-rotate-x", `${rotateX.toFixed(2)}deg`);
  vault.style.setProperty("--vault-rotate-y", `${rotateY.toFixed(2)}deg`);
}

function resetVaultTilt(vault) {
  vault.style.setProperty("--vault-rotate-x", "0deg");
  vault.style.setProperty("--vault-rotate-y", "0deg");
}

function getVaultHoverBounds(hitbox, motionConfig) {
  const rect = hitbox.getBoundingClientRect();
  const scaleOverflowX = Math.max((motionConfig.hoverScale - 1) * rect.width * 0.5, 0);
  const scaleOverflowY = Math.max(
    (motionConfig.hoverScale - 1) * rect.height * 0.5,
    0
  );

  return {
    rect,
    left: rect.left - scaleOverflowX - HOVER_BOUNDS_SAFETY_PX,
    right: rect.right + scaleOverflowX + HOVER_BOUNDS_SAFETY_PX,
    top:
      rect.top +
      Math.min(motionConfig.hoverLift, 0) -
      scaleOverflowY -
      HOVER_BOUNDS_SAFETY_PX,
    bottom:
      rect.bottom +
      Math.max(motionConfig.hoverLift, 0) +
      scaleOverflowY +
      HOVER_BOUNDS_SAFETY_PX,
  };
}

function isPointerInsideHoverBounds(bounds, event) {
  return (
    event.clientX >= bounds.left &&
    event.clientX <= bounds.right &&
    event.clientY >= bounds.top &&
    event.clientY <= bounds.bottom
  );
}

vaultHitboxes.forEach((vaultHitbox) => {
  const vault = vaultHitbox.querySelector(".vault");
  let latestPointerEvent = null;
  let frameId = null;

  if (!vault) {
    return;
  }

  const motionConfig = getVaultMotionConfig(vault);

  function cancelScheduledFrame() {
    if (frameId === null) {
      return;
    }

    cancelAnimationFrame(frameId);
    frameId = null;
  }

  function shouldIgnorePointer(event) {
    return reducedMotionQuery.matches || event.pointerType === "touch";
  }

  function clearInteractiveState() {
    latestPointerEvent = null;
    cancelScheduledFrame();
    vaultHitbox.classList.remove("is-hovered");
    resetVaultTilt(vault);
  }

  function updateInteractiveState() {
    frameId = null;

    if (!latestPointerEvent) {
      return;
    }

    const hoverBounds = getVaultHoverBounds(vaultHitbox, motionConfig);

    if (!isPointerInsideHoverBounds(hoverBounds, latestPointerEvent)) {
      clearInteractiveState();
      return;
    }

    vaultHitbox.classList.add("is-hovered");
    setVaultTilt(vault, hoverBounds.rect, latestPointerEvent, motionConfig.maxTilt);
  }

  function scheduleInteractiveUpdate(event) {
    latestPointerEvent = {
      clientX: event.clientX,
      clientY: event.clientY,
    };

    if (frameId !== null) {
      return;
    }

    frameId = requestAnimationFrame(updateInteractiveState);
  }

  function handlePointerEnter(event) {
    if (shouldIgnorePointer(event)) {
      return;
    }

    scheduleInteractiveUpdate(event);
  }

  function handlePointerMove(event) {
    if (shouldIgnorePointer(event)) {
      return;
    }

    if (!vaultHitbox.classList.contains("is-hovered") && !latestPointerEvent) {
      return;
    }

    scheduleInteractiveUpdate(event);
  }

  function handlePointerLeave(event) {
    if (shouldIgnorePointer(event)) {
      return;
    }

    const hoverBounds = getVaultHoverBounds(vaultHitbox, motionConfig);

    if (isPointerInsideHoverBounds(hoverBounds, event)) {
      latestPointerEvent = {
        clientX: event.clientX,
        clientY: event.clientY,
      };
      return;
    }

    clearInteractiveState();
  }

  vaultHitbox.addEventListener("pointerenter", handlePointerEnter);
  vaultHitbox.addEventListener("pointermove", handlePointerMove);
  vaultHitbox.addEventListener("pointerleave", handlePointerLeave);
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("blur", clearInteractiveState);

  vaultHitbox.addEventListener("pointercancel", clearInteractiveState);
});

reducedMotionQuery.addEventListener("change", (event) => {
  if (!event.matches) {
    return;
  }

  vaultHitboxes.forEach((vaultHitbox) => {
    const vault = vaultHitbox.querySelector(".vault");

    vaultHitbox.classList.remove("is-hovered");

    if (!vault) {
      return;
    }

    resetVaultTilt(vault);
  });
});
