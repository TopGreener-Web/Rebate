class RotatingSlides extends HTMLElement {
  setup(options) {
    this.slideSelector = options.slideSelector;
    this.activeClass = options.activeClass || 'is-active';
    this.previousSelector = options.previousSelector;
    this.nextSelector = options.nextSelector;
    this.dotSelector = options.dotSelector;

    this.slides = Array.from(this.querySelectorAll(this.slideSelector));
    this.dots = this.dotSelector ? Array.from(this.querySelectorAll(this.dotSelector)) : [];
    this.currentIndex = Math.max(0, this.slides.findIndex((slide) => slide.classList.contains(this.activeClass)));
    this.speed = Number(this.dataset.speed) || options.defaultSpeed || 5000;
    this.autoplay = this.dataset.autoplay === 'true';
    this.timer = null;

    if (this.slides.length <= 1) {
      this.classList.add('is-single');
    }

    this.showSlide(this.currentIndex);
    this.bindRotationEvents();
    this.start();
  }

  disconnectedCallback() {
    this.stop();
  }

  bindRotationEvents() {
    this.querySelectorAll(this.previousSelector).forEach((button) => {
      button.addEventListener('click', () => this.goTo(this.currentIndex - 1));
    });

    this.querySelectorAll(this.nextSelector).forEach((button) => {
      button.addEventListener('click', () => this.goTo(this.currentIndex + 1));
    });

    this.dots.forEach((dot) => {
      dot.addEventListener('click', () => {
        this.goTo(Number(dot.dataset.slideIndex));  
      });
    });

    this.addEventListener('mouseenter', () => this.stop());
    this.addEventListener('mouseleave', () => this.start());
    this.addEventListener('focusin', () => this.stop());
    this.addEventListener('focusout', () => this.start());
  }

  goTo(index) {
    this.stop();
    this.showSlide(index);
    this.start();
  }

  showSlide(index) {
    if (!this.slides.length) return;

    this.currentIndex = (index + this.slides.length) % this.slides.length;

    this.slides.forEach((slide, slideIndex) => {
      const isActive = slideIndex === this.currentIndex;
      slide.classList.toggle(this.activeClass, isActive);
      slide.setAttribute('aria-hidden', String(!isActive));
      slide.tabIndex = isActive ? 0 : -1;
    });

    this.dots.forEach((dot, dotIndex) => {
      const isActive = dotIndex === this.currentIndex;
      dot.classList.toggle(this.activeClass, isActive);
      dot.setAttribute('aria-selected', String(isActive));
    });
  }

  start() {
    if (!this.autoplay || this.slides.length <= 1 || this.timer) return;

    this.timer = window.setInterval(() => {
      this.showSlide(this.currentIndex + 1);
    }, this.speed);
  }

  stop() {
    window.clearInterval(this.timer);
    this.timer = null;
  }
}

class AnnouncementBar extends RotatingSlides {
  connectedCallback() {
    this.setup({
      slideSelector: '.announcement-bar__slide',
      previousSelector: '[data-direction="previous"]',
      nextSelector: '[data-direction="next"]',
      defaultSpeed: 5000,
    });
  }
}

class PromoSlider extends RotatingSlides {
  connectedCallback() {
    this.setup({
      slideSelector: '.promo-slider__slide',
      previousSelector: '[data-slider-direction="previous"]',
      nextSelector: '[data-slider-direction="next"]',
      dotSelector: '.promo-slider__dot',
      defaultSpeed: 6500,
    });
  }
}

customElements.define('announcement-bar', AnnouncementBar);
customElements.define('promo-slider', PromoSlider);
