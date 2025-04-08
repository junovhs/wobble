document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded for proj.Youtube-strategy');

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId); 
            
            if (targetElement) {
                const offsetTop = targetElement.getBoundingClientRect().top + window.scrollY;
                // Adjust offset dynamically based on nav height if it's sticky
                const navHeight = document.querySelector('nav')?.offsetHeight || 0; 
                
                window.scrollTo({
                    top: offsetTop - navHeight - 20, // Extra 20px buffer
                    behavior: 'smooth'
                });
            } else {
                console.warn(`Smooth scroll target not found: ${targetId}`);
            }
        });
    });
    
    // Intersection Observer for animations (more reliable than scroll event)
    const cardsToAnimate = document.querySelectorAll('.series-card, .benefit-card, .goal-card');
    
    if ('IntersectionObserver' in window) {
        console.log('IntersectionObserver is available.');
        
        const observerOptions = {
            root: null, // Use the viewport as the root
            rootMargin: '0px',
            threshold: 0.1 // Trigger when 10% of the element is visible
        };

        const observerCallback = (entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // console.log('Element intersecting:', entry.target);
                    entry.target.classList.add('in-view');
                    observer.unobserve(entry.target); // Stop observing once animated
                }
            });
        };

        const animationObserver = new IntersectionObserver(observerCallback, observerOptions);

        cardsToAnimate.forEach(card => {
            // console.log('Observing card:', card);
            // Ensure initial styles are applied if CSS doesn't handle it (CSS should handle it now)
            // card.style.opacity = '0';
            // card.style.transform = 'translateY(20px)';
            animationObserver.observe(card);
        });

    } else {
        // Fallback for older browsers (simplified scroll animation)
        console.warn('IntersectionObserver not supported, using basic scroll check.');
        const fallbackAnimate = () => {
             cardsToAnimate.forEach(card => {
                const cardTop = card.getBoundingClientRect().top;
                if (cardTop < window.innerHeight * 0.85 && !card.classList.contains('in-view')) {
                     card.classList.add('in-view');
                }
            });
        };
        window.addEventListener('scroll', fallbackAnimate);
        requestAnimationFrame(fallbackAnimate); // Initial check
    }

    // Initialize expandable series cards
    const seriesCards = document.querySelectorAll('.series-card');
    seriesCards.forEach(card => {
        const videoList = card.querySelector('.video-list');
        // Only add listener if there's a video list to expand/collapse
        if (videoList) { 
             // Set initial accessible state if needed (handled by CSS now)
            // videoList.style.maxHeight = '0px';
            // videoList.style.overflow = 'hidden';
            // videoList.style.visibility = 'hidden';

            card.addEventListener('click', function() {
                console.log('Card clicked:', this);
                const isExpanded = this.classList.contains('expanded');
                
                // Collapse any other expanded cards first (optional accordion behavior)
                /*
                if (!isExpanded) {
                    seriesCards.forEach(otherCard => {
                        if (otherCard !== this && otherCard.classList.contains('expanded')) {
                            otherCard.classList.remove('expanded');
                        }
                    });
                }
                */

                this.classList.toggle('expanded');

                // Optional: Log state after toggle
                // console.log('Card expanded state:', this.classList.contains('expanded'));
                
                // ARIA attributes for accessibility
                const contentId = videoList.id || `video-list-${Math.random().toString(36).substr(2, 9)}`;
                videoList.id = contentId; // Ensure the list has an ID
                card.setAttribute('aria-expanded', !isExpanded);
                videoList.setAttribute('aria-hidden', isExpanded);


            });

             // Set initial ARIA attributes
             const contentId = videoList.id || `video-list-${Math.random().toString(36).substr(2, 9)}`;
             videoList.id = contentId;
             card.setAttribute('aria-controls', contentId);
             card.setAttribute('aria-expanded', 'false');
             videoList.setAttribute('aria-hidden', 'true');
             card.setAttribute('role', 'button'); // Indicate it's clickable


        } else {
            // Make non-expandable cards non-interactive visually
             card.style.cursor = 'default';
             const indicator = card.querySelector('::after'); // Pseudo-element needs CSS targeting
             if (indicator) indicator.style.display = 'none'; // Might not work directly on pseudo
             // Consider adding a class to hide ::after via CSS if no .video-list present
             card.classList.add('no-expand'); 
        }
    });
    
    // Add data-labels to table cells for responsive view
    const addTableLabels = () => {
        try {
            const rows = document.querySelectorAll('.strategy-table .table-row');
            // Match headers exactly as they appear in the HTML
            const headers = ['Series', 'Style', 'Lift', 'Duration', 'Goal', 'Notes']; 
            
            rows.forEach(row => {
                const cells = row.querySelectorAll('div');
                if (cells.length === headers.length) {
                    cells.forEach((cell, index) => {
                        // Use the header text directly for the label
                        const label = headers[index] + ':'; 
                        cell.setAttribute('data-label', label);
                    });
                } else {
                    console.warn('Mismatch between headers and cells in a table row:', row);
                }
            });
            console.log('Table labels added.');
        } catch (error) {
            console.error('Error adding table labels:', error);
        }
    }
    
    // Initialize page functions
    const initPage = () => {
        addTableLabels(); 
        // Animations are now handled by IntersectionObserver or fallback scroll listener setup above
    };

    // Delay init slightly if needed, but DOMContentLoaded should be sufficient
    // setTimeout(initPage, 0); 
    initPage();

});

// Add a simple error handler for script load issues
window.addEventListener('error', function(event) {
    if (event.target.tagName === 'SCRIPT' && event.target.src.includes('script.js')) {
        console.error('Failed to load or execute script.js:', event.message);
    }
}, true); // Use capture phase