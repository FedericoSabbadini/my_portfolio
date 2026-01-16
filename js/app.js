/**
 * Main Application
 * Initialize portfolio site with modular components
 */

class PortfolioApp {
    constructor() {
        this.data = {};
        this.currentPage = this.getCurrentPage();
    }

    /**
     * Get current page name from URL
     */
    getCurrentPage() {
        const path = window.location.pathname;
        const page = path.split('/').pop().replace('.html', '') || 'index';
        return page;
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            // Load components
            await this.loadComponents();
            
            // Load data
            await this.loadData();
            
            // Initialize navigation
            this.initNavigation();
            
            // Populate footer with data
            this.populateFooter();
            
            // Initialize page-specific features
            this.initPageFeatures();
            
            // Initialize animations
            this.initAnimations();
            
            console.log('✅ Portfolio initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing portfolio:', error);
        }
    }

    /**
     * Load all components
     */
    async loadComponents() {
        // Create placeholders if they don't exist
        if (!document.getElementById('navbar-placeholder')) {
            const nav = document.createElement('div');
            nav.id = 'navbar-placeholder';
            document.body.insertBefore(nav, document.body.firstChild);
        }

        if (!document.getElementById('footer-placeholder')) {
            const footer = document.createElement('div');
            footer.id = 'footer-placeholder';
            document.body.appendChild(footer);
        }

        await window.ComponentLoader.loadComponents([
            { name: 'navbar', targetId: 'navbar-placeholder' },
            { name: 'footer', targetId: 'footer-placeholder' }
        ]);
    }

    /**
     * Load all data files
     */
    async loadData() {
        this.data = await window.DataLoader.loadMultiple([
            'personal',
            'projects'
        ]);
    }

    /**
     * Initialize navigation
     */
    initNavigation() {
        // Set active nav link
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            const page = link.getAttribute('data-page');
            if (page === this.currentPage || 
                (this.currentPage === '' && page === 'index')) {
                link.classList.add('active');
            }
        });

        // Mobile menu toggle
        const navToggle = document.getElementById('navToggle');
        const navMenu = document.getElementById('navMenu');
        
        if (navToggle && navMenu) {
            navToggle.addEventListener('click', () => {
                navMenu.classList.toggle('active');
                
                // Animate hamburger
                const spans = navToggle.querySelectorAll('span');
                if (navMenu.classList.contains('active')) {
                    spans[0].style.transform = 'rotate(45deg) translate(7px, 7px)';
                    spans[1].style.opacity = '0';
                    spans[2].style.transform = 'rotate(-45deg) translate(6px, -6px)';
                } else {
                    spans[0].style.transform = 'none';
                    spans[1].style.opacity = '1';
                    spans[2].style.transform = 'none';
                }
            });

            // Close menu on link click
            navLinks.forEach(link => {
                link.addEventListener('click', () => {
                    navMenu.classList.remove('active');
                    const spans = navToggle.querySelectorAll('span');
                    spans[0].style.transform = 'none';
                    spans[1].style.opacity = '1';
                    spans[2].style.transform = 'none';
                });
            });
        }

        // Navbar scroll effect
        let lastScroll = 0;
        const navbar = document.querySelector('.navbar');
        
        if (navbar) {
            window.addEventListener('scroll', () => {
                const currentScroll = window.pageYOffset;
                
                if (currentScroll > 100) {
                    navbar.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
                } else {
                    navbar.style.boxShadow = 'none';
                }
                
                lastScroll = currentScroll;
            });
        }
    }

    /**
     * Populate footer with personal data
     */
    populateFooter() {
        if (!this.data.personal) return;

        const personal = this.data.personal;
        
        // Update footer links
        const githubLink = document.getElementById('footer-github');
        const linkedinLink = document.getElementById('footer-linkedin');
        const emailLink = document.getElementById('footer-email');
        
        if (githubLink) {
            githubLink.href = `https://github.com/${personal.github}`;
        }
        if (linkedinLink) {
            linkedinLink.href = `https://linkedin.com/in/${personal.linkedin}`;
        }
        if (emailLink) {
            emailLink.href = `mailto:${personal.email}`;
        }

        // Update year
        const yearSpan = document.getElementById('footer-year');
        if (yearSpan) {
            yearSpan.textContent = new Date().getFullYear();
        }
    }

    /**
     * Initialize page-specific features
     */
    initPageFeatures() {
        // Smooth scroll for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }

    /**
     * Initialize scroll animations
     */
    initAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, observerOptions);

        // Observe animatable elements
        document.querySelectorAll('.card, .project-card, .news-item, .resource-card, .course-card, .cert-card').forEach(element => {
            element.style.opacity = '0';
            element.style.transform = 'translateY(20px)';
            element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            observer.observe(element);
        });

        // Language bars animation
        setTimeout(() => {
            document.querySelectorAll('.language-fill').forEach(bar => {
                const width = bar.style.width;
                bar.style.width = '0';
                setTimeout(() => {
                    bar.style.transition = 'width 1s ease';
                    bar.style.width = width;
                }, 100);
            });
        }, 500);
    }

    /**
     * Get personal data
     */
    getPersonalData() {
        return this.data.personal || {};
    }

    /**
     * Get projects data
     */
    getProjectsData() {
        return this.data.projects || {};
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.PortfolioApp = new PortfolioApp();
    window.PortfolioApp.init();
});
