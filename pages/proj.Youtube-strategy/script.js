document.addEventListener('DOMContentLoaded', () => {
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            // Adjust selector to potentially handle renamed IDs if necessary
            const targetElement = document.querySelector(targetId); 
            
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 80, // Account for sticky header height
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Animation on scroll for cards
    const animateOnScroll = () => {
        // Updated selector to include goal-card as well
        const cards = document.querySelectorAll('.series-card, .benefit-card, .goal-card'); 
        
        cards.forEach(card => {
            const cardTop = card.getBoundingClientRect().top;
            const windowHeight = window.innerHeight;
            
            // Trigger animation slightly earlier
            if (cardTop < windowHeight * 0.85) { 
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }
        });
    };
    
    const initAnimations = () => {
        const cards = document.querySelectorAll('.series-card, .benefit-card, .goal-card');
        
        cards.forEach(card => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        });
        
        // Run once on load
        requestAnimationFrame(animateOnScroll); // Use rAF for smoother initial render
        
        // Then on scroll
        window.addEventListener('scroll', animateOnScroll);
    };
    
    // Initialize expandable series cards
    const seriesCards = document.querySelectorAll('.series-card');
    seriesCards.forEach(card => {
        // Ensure card has video list before adding listener
        const videoList = card.querySelector('.video-list');
        if (videoList) {
            card.addEventListener('click', function() {
                this.classList.toggle('expanded');
                // Check if videoList exists again inside the handler (best practice)
                const currentVideoList = this.querySelector('.video-list'); 
                if (currentVideoList) {
                    if (currentVideoList.style.maxHeight && currentVideoList.style.maxHeight !== '0px') {
                        currentVideoList.style.maxHeight = '0px'; // Explicitly set to 0 for closing
                    } else {
                        // Set max-height slightly larger than scrollHeight to avoid clipping
                        currentVideoList.style.maxHeight = (currentVideoList.scrollHeight + 10) + "px"; 
                    }
                }
            });
            // Set initial max-height to 0 for non-expanded cards
             videoList.style.maxHeight = '0px';
             videoList.style.overflow = 'hidden'; // Ensure overflow hidden
        } else {
            // Optional: Remove the '+'/'−' indicator if there's no list
             const indicator = card.querySelector('::after'); // May need specific selector
             if(indicator) indicator.style.display = 'none';
             card.style.cursor = 'default'; // Change cursor if not clickable
        }
    });
    
    // Add data-labels to table cells for responsive view
    const addTableLabels = () => {
        const rows = document.querySelectorAll('.strategy-table .table-row');
        const headers = ['Series', 'Style', 'Lift', 'Duration', 'Goal', 'Notes'];
        rows.forEach(row => {
            const cells = row.querySelectorAll('div');
            cells.forEach((cell, index) => {
                if (headers[index]) {
                    cell.setAttribute('data-label', headers[index] + ':');
                }
            });
        });
    }
    
    // Initialize animations and other setup
    const initPage = () => {
        initAnimations();
        addTableLabels(); // Add table labels for responsive styles
    };

    initPage();
});