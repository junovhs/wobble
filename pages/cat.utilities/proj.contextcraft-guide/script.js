document.addEventListener('DOMContentLoaded', function() {
    const navLinks = document.querySelectorAll('nav a');
    const currentFullUrl = window.location.href;
    const currentPathname = window.location.pathname;
    // Normalize currentPath to handle cases like '/' or '/index.html' as 'index.html'
    let currentPath = currentPathname.substring(currentPathname.lastIndexOf('/') + 1);
    if (currentPath === '' || currentPath === 'index.html') {
        currentPath = 'index.html';
    } else if (currentPathname.endsWith('/checklist.html')) {
        currentPath = 'checklist.html';
    }
    const currentHash = window.location.hash;

    // Function to set active link
    function setActiveLink() {
        navLinks.forEach(link => {
            link.classList.remove('active');
            const linkHref = link.getAttribute('href');
            let linkPageName = linkHref.split('#')[0];
            linkPageName = linkPageName.substring(linkPageName.lastIndexOf('/') + 1);

            if (linkPageName === '' || linkPageName === 'index.html') {
                linkPageName = 'index.html';
            }
            
            const linkHash = linkHref.includes('#') ? '#' + linkHref.split('#')[1] : '';

            if (linkPageName === currentPath) { // Page matches
                if (currentPath === 'index.html') {
                    // For index.html, match hash or default to #overview if no hash
                    if (linkHash && linkHash === currentHash) {
                        link.classList.add('active');
                    } else if ((!currentHash || currentHash === '#') && linkHash === '#overview') {
                        link.classList.add('active');
                    }
                } else {
                    // For other pages (e.g., checklist.html), it's active if path matches
                    link.classList.add('active');
                }
            }
        });
    }
    
    setActiveLink(); // Set active link on initial load

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const linkHref = this.getAttribute('href');
            let linkPageName = linkHref.split('#')[0];
            linkPageName = linkPageName.substring(linkPageName.lastIndexOf('/') + 1);
             if (linkPageName === '' || linkPageName === 'index.html') {
                linkPageName = 'index.html';
            }

            if (linkPageName === currentPath && linkHref.startsWith('#')) { // Same page, hash link
                e.preventDefault();
                
                const targetId = this.hash; 
                const targetSection = document.querySelector(targetId);
                
                if (targetSection) {
                    window.scrollTo({
                        top: targetSection.offsetTop - 80, 
                        behavior: 'smooth'
                    });
                    if(history.pushState) {
                        history.pushState(null, null, targetId);
                    } else {
                        window.location.hash = targetId;
                    }
                }
                navLinks.forEach(lnk => lnk.classList.remove('active'));
                this.classList.add('active');

            } 
            // No 'else' needed here, default navigation will occur for different pages.
            // setActiveLink will be called on the new page load.
        });
    });
    
    // Active section detection on scroll (only for index.html with sections)
    if (currentPath === 'index.html') {
        const sections = document.querySelectorAll('main .section'); 
        
        function setActiveNavOnScroll() {
            let currentSectionId = null;
            const offset = 100; // Offset for header height + a bit more

            sections.forEach(section => {
                const sectionTop = section.offsetTop - offset;
                const sectionBottom = sectionTop + section.offsetHeight;
                
                if (window.scrollY >= sectionTop && window.scrollY < sectionBottom) {
                    currentSectionId = section.getAttribute('id');
                }
            });

            if (!currentSectionId && sections.length > 0 && window.scrollY < (sections[0].offsetTop - offset) ) {
                 currentSectionId = "overview";
            }


            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${currentSectionId}`) {
                    link.classList.add('active');
                }
            });
             // Fallback to #overview if nothing else is active (e.g. at the very top before first section)
            const isActiveSet = Array.from(navLinks).some(l => l.classList.contains('active'));
            if (!isActiveSet && currentHash === '' || currentHash === '#') {
                const overviewLink = document.querySelector('nav a[href="#overview"]');
                if (overviewLink) overviewLink.classList.add('active');
            }
        }
        
        window.addEventListener('scroll', setActiveNavOnScroll);
        setActiveNavOnScroll(); 
    }
    
    // Update milestones progress on load (only if on index.html)
    if (currentPath === 'index.html') {
      updateMilestonesProgress(); 
    }
    
    function updateMilestonesProgress() {
        const phases = document.querySelectorAll('.phase');
        
        phases.forEach(phase => {
            const milestones = phase.querySelectorAll('.milestone');
            const completedMilestones = phase.querySelectorAll('.milestone.complete').length;
            const inProgressMilestones = phase.querySelectorAll('.milestone.in-progress').length;
            
            const totalMilestones = milestones.length;
            if (totalMilestones > 0) {
                // Count in-progress milestones as 0.5 towards completion for progress calculation
                const progressPercentage = Math.round(((completedMilestones + (inProgressMilestones * 0.5)) / totalMilestones) * 100);
                
                const progressBar = phase.querySelector('.progress-bar .progress'); // Target .progress within .progress-bar
                const phaseMetaProgress = phase.querySelector('.phase-title .progress'); // Also target progress in title for consistency if it exists


                if (progressBar) {
                    progressBar.style.width = `${progressPercentage}%`;
                    progressBar.textContent = `${progressPercentage}%`;
                }
                if (phaseMetaProgress && phaseMetaProgress !== progressBar) { // If there's a separate one in title
                    phaseMetaProgress.style.width = `${progressPercentage}%`;
                    phaseMetaProgress.textContent = `${progressPercentage}%`;
                }

                // Update phase badge based on progress
                const phaseBadge = phase.querySelector('.phase-meta .badge');
                if (phaseBadge) {
                    if (progressPercentage === 100) {
                        phaseBadge.textContent = 'Complete';
                        phaseBadge.classList.remove('in-progress', 'upcoming');
                        phaseBadge.classList.add('success');
                    } else if (progressPercentage > 0) {
                        phaseBadge.textContent = 'In Progress';
                        phaseBadge.classList.remove('success', 'upcoming');
                        phaseBadge.classList.add('in-progress');
                    } else {
                         // Keep 'Upcoming' if 0%, or rely on initial HTML class
                    }
                }
            }
        });
    }

    // Checklist page specific JavaScript
    if (currentPath === 'checklist.html') {
        const mainCheckboxes = document.querySelectorAll('.checklist-item-main input[type="checkbox"]');
        const subCheckboxes = document.querySelectorAll('.checklist-sub-items .checklist-item input[type="checkbox"]');

        function updateParentCheckbox(parentContainer) {
            const mainCheckbox = parentContainer.querySelector('.checklist-item-main input[type="checkbox"]');
            const subItems = parentContainer.querySelectorAll('.checklist-sub-items .checklist-item input[type="checkbox"]');
            
            if (!mainCheckbox || subItems.length === 0) return;

            const checkedCount = Array.from(subItems).filter(cb => cb.checked).length;

            if (checkedCount === 0) {
                mainCheckbox.checked = false;
                mainCheckbox.indeterminate = false;
            } else if (checkedCount === subItems.length) {
                mainCheckbox.checked = true;
                mainCheckbox.indeterminate = false;
            } else {
                mainCheckbox.checked = false;
                mainCheckbox.indeterminate = true;
            }
        }

        mainCheckboxes.forEach(mainCheckbox => {
            mainCheckbox.addEventListener('change', function() {
                const parentContainer = this.closest('.checklist-item-container');
                const subItems = parentContainer.querySelectorAll('.checklist-sub-items .checklist-item input[type="checkbox"]');
                subItems.forEach(subCheckbox => {
                    subCheckbox.checked = this.checked;
                });
            });
            // Initial state update for parent based on children
            const parentContainer = mainCheckbox.closest('.checklist-item-container');
            if (parentContainer) {
                 updateParentCheckbox(parentContainer);
            }
        });

        subCheckboxes.forEach(subCheckbox => {
            subCheckbox.addEventListener('change', function() {
                const parentContainer = this.closest('.checklist-item-container');
                if (parentContainer) {
                    updateParentCheckbox(parentContainer);
                }
            });
        });
        
        // Initialize all parent checkboxes based on their children's default states (if any were pre-checked)
        document.querySelectorAll('.checklist-item-container').forEach(container => {
            updateParentCheckbox(container);
        });
    }
});