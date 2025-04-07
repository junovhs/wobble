document.addEventListener('DOMContentLoaded', () => {
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 80, // Account for sticky header
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Form submission handling
    const form = document.querySelector('.cta-form');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = this.querySelector('input[type="email"]').value;
            
            // Simple validation
            if (!email || !email.includes('@')) {
                alert('Please enter a valid email address');
                return;
            }
            
            // Here you would typically send the data to a server
            // For demo purposes, just show a success message
            this.innerHTML = '<p class="success-message">Thanks for signing up! We\'ll be in touch soon.</p>';
        });
    }
    
    // Animation on scroll for cards
    const animateOnScroll = () => {
        const cards = document.querySelectorAll('.series-card, .benefit-card');
        
        cards.forEach(card => {
            const cardTop = card.getBoundingClientRect().top;
            const windowHeight = window.innerHeight;
            
            if (cardTop < windowHeight * 0.9) {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }
        });
    };
    
    const initAnimations = () => {
        const cards = document.querySelectorAll('.series-card, .benefit-card');
        
        cards.forEach(card => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        });
        
        // Run once on load
        animateOnScroll();
        
        // Then on scroll
        window.addEventListener('scroll', animateOnScroll);
    };
    
    initAnimations();

    // Initialize expandable series cards
    const seriesCards = document.querySelectorAll('.series-card');
    seriesCards.forEach(card => {
        card.addEventListener('click', function() {
            this.classList.toggle('expanded');
            const videoList = this.querySelector('.video-list');
            if (videoList) {
                if (videoList.style.maxHeight) {
                    videoList.style.maxHeight = null;
                } else {
                    videoList.style.maxHeight = videoList.scrollHeight + "px";
                }
            }
        });
    });
});