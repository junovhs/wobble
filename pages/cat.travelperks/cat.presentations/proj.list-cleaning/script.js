import { gsap } from 'gsap';

document.addEventListener('DOMContentLoaded', () => {
    const slides = document.querySelectorAll('.slide');
    const prevBtn = document.getElementById('prev');
    const nextBtn = document.getElementById('next');
    const currentSlideElem = document.getElementById('current-slide');
    const totalSlidesElem = document.getElementById('total-slides');
    const progressIndicator = document.querySelector('.progress-indicator');
    
    let currentIndex = 0;
    const totalSlides = slides.length;
    
    // Initialize slide counter and progress bar
    totalSlidesElem.textContent = totalSlides;
    updateSlideCounter();
    updateProgressBar();
    updateNavButtons();
    
    // Handle Next button click
    nextBtn.addEventListener('click', () => {
        if (currentIndex < totalSlides - 1) {
            changeSlide(currentIndex + 1);
        }
    });
    
    // Handle Previous button click
    prevBtn.addEventListener('click', () => {
        if (currentIndex > 0) {
            changeSlide(currentIndex - 1);
        }
    });
    
    // Handle keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
            if (currentIndex < totalSlides - 1) {
                changeSlide(currentIndex + 1);
            }
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
            if (currentIndex > 0) {
                changeSlide(currentIndex - 1);
            }
        }
    });
    
    // Function to change slides
    function changeSlide(newIndex) {
        if (newIndex === currentIndex) return;
        
        // Determine direction
        const direction = newIndex > currentIndex ? 1 : -1;
        
        // Current slide
        const currentSlide = slides[currentIndex];
        
        // Next slide
        const nextSlide = slides[newIndex];
        
        // Remove active class from current slide
        currentSlide.classList.remove('active');
        
        // Add prev class if going backward
        if (direction === -1) {
            currentSlide.classList.add('prev');
            nextSlide.classList.remove('prev');
        } else {
            // Remove prev class if it exists
            currentSlide.classList.remove('prev');
        }
        
        // Add active class to next slide
        nextSlide.classList.add('active');
        
        // Animate content of the new slide
        animateSlideContent(nextSlide);
        
        // Update current index
        currentIndex = newIndex;
        
        // Update UI
        updateSlideCounter();
        updateProgressBar();
        updateNavButtons();
    }
    
    // Function to animate slide content
    function animateSlideContent(slide) {
        // Get all animated elements in the slide
        const elements = slide.querySelectorAll('h1, h2, h3, h4, p, .goal-list li, .timeline-item, .step-item, .bounce-type, .action-item, .engagement-step, .maintenance-item, .consideration-item, .metric');
        
        // Reset any existing animations
        gsap.set(elements, { opacity: 0, y: 20 });
        
        // Create staggered animation
        gsap.to(elements, {
            opacity: 1,
            y: 0,
            duration: 0.5,
            stagger: 0.1,
            ease: "power2.out"
        });
    }
    
    // Update slide counter
    function updateSlideCounter() {
        currentSlideElem.textContent = currentIndex + 1;
    }
    
    // Update progress bar
    function updateProgressBar() {
        const progress = ((currentIndex + 1) / totalSlides) * 100;
        progressIndicator.style.width = `${progress}%`;
    }
    
    // Update navigation buttons (disable when at ends)
    function updateNavButtons() {
        prevBtn.disabled = currentIndex === 0;
        nextBtn.disabled = currentIndex === totalSlides - 1;
    }
    
    // Initialize animation for first slide
    animateSlideContent(slides[0]);
    
    // Handle touch events for mobile
    let touchStartX = 0;
    let touchEndX = 0;
    
    document.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, false);
    
    document.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, false);
    
    function handleSwipe() {
        // Threshold for swipe distance (px)
        const threshold = 50;
        
        // Left swipe
        if (touchEndX < touchStartX - threshold) {
            if (currentIndex < totalSlides - 1) {
                changeSlide(currentIndex + 1);
            }
        }
        
        // Right swipe
        if (touchEndX > touchStartX + threshold) {
            if (currentIndex > 0) {
                changeSlide(currentIndex - 1);
            }
        }
    }
});

