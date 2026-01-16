/**
 * Portfolio Application
 * Main application controller
 */

class PortfolioApp {
    constructor() {
        this.data = {};
        this.currentPage = this.getCurrentPage();
        this.dataLoader = window.DataLoader;
        this.renderer = window.TemplateRenderer;
        this.componentLoader = window.ComponentLoader;
    }

    /**
     * Get current page from URL
     * @returns {string}
     */
    getCurrentPage() {
        const path = window.location.pathname;
        const page = path.split('/').pop().replace('.html', '') || 'index';
        return page === '' ? 'index' : page;
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            // Load components (navbar, footer)
            await this.loadComponents();
            
            // Load required data files
            await this.loadData();
            
            // Initialize navigation
            this.initNavigation();
            
            // Render page content
            await this.renderPage();
            
            // Initialize animations
            this.initAnimations();

            // Hide page loader and show content
            this.showPage();
            
            console.log('✅ Portfolio initialized successfully');
        } catch (error) {
            console.error('❌ Portfolio initialization error:', error);
            this.showPage(); // Show page anyway on error
        }
    }

    /**
     * Show page after loading
     */
    showPage() {
        const loader = document.getElementById('page-loader');
        if (loader) {
            loader.classList.add('hidden');
            setTimeout(() => loader.remove(), 300);
        }
        document.body.classList.remove('loading');
    }

    /**
     * Load components
     */
    async loadComponents() {
        const components = [];
        
        // Navbar is now static in HTML to prevent flash
        // Only load footer dynamically
        if (document.getElementById('footer-placeholder') && !document.getElementById('footer-placeholder').hasChildNodes()) {
            components.push({ name: 'footer', targetId: 'footer-placeholder' });
        }

        if (components.length > 0) {
            await this.componentLoader.loadComponents(components);
        }
    }

    /**
     * Load data files based on current page
     */
    async loadData() {
        // Always load site config and personal data
        const requiredFiles = ['site', 'personal'];
        
        // Page-specific data
        const pageDataMap = {
            'index': ['projects'],
            'about': ['education'],
            'contacts': [],
            'courses': ['courses', 'certifications'],
            'resources': ['projects'],
            'news': ['news']
        };

        const pageFiles = pageDataMap[this.currentPage] || [];
        const allFiles = [...new Set([...requiredFiles, ...pageFiles])];
        
        this.data = await this.dataLoader.loadMultiple(allFiles);
    }

    /**
     * Initialize navigation
     */
    initNavigation() {
        // Set active nav link
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            const page = link.getAttribute('data-page');
            if (page === this.currentPage) {
                link.classList.add('active');
            }
        });

        // Mobile menu toggle
        const navToggle = document.getElementById('navToggle');
        const navMenu = document.getElementById('navMenu');
        
        if (navToggle && navMenu) {
            navToggle.addEventListener('click', () => {
                navMenu.classList.toggle('active');
                this.animateHamburger(navToggle, navMenu.classList.contains('active'));
            });

            // Close menu on link click
            navLinks.forEach(link => {
                link.addEventListener('click', () => {
                    navMenu.classList.remove('active');
                    this.animateHamburger(navToggle, false);
                });
            });
        }

        // Navbar scroll effect
        this.initNavbarScroll();
    }

    /**
     * Animate hamburger menu icon
     */
    animateHamburger(toggle, isActive) {
        const spans = toggle.querySelectorAll('span');
        if (isActive) {
            spans[0].style.transform = 'rotate(45deg) translate(7px, 7px)';
            spans[1].style.opacity = '0';
            spans[2].style.transform = 'rotate(-45deg) translate(6px, -6px)';
        } else {
            spans[0].style.transform = 'none';
            spans[1].style.opacity = '1';
            spans[2].style.transform = 'none';
        }
    }

    /**
     * Initialize navbar scroll behavior
     */
    initNavbarScroll() {
        const navbar = document.querySelector('.navbar');
        if (!navbar) return;

        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 100) {
                navbar.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
            } else {
                navbar.style.boxShadow = 'none';
            }
        });
    }

    /**
     * Render page content based on current page
     */
    async renderPage() {
        const pageRenderers = {
            'index': () => this.renderHomePage(),
            'about': () => this.renderAboutPage(),
            'contacts': () => this.renderContactsPage(),
            'courses': () => this.renderCoursesPage(),
            'resources': () => this.renderResourcesPage(),
            'news': () => this.renderNewsPage()
        };

        const renderer = pageRenderers[this.currentPage];
        if (renderer) {
            await renderer();
        }

        // Render common elements
        this.renderCTA();
        this.renderFooter();
    }

    /**
     * Render home page
     */
    renderHomePage() {
        const personal = this.data.personal?.personal;
        const social = this.data.personal?.social;
        const stats = this.data.personal?.stats;
        const projects = this.data.projects?.featured;

        // Render hero
        if (personal && social) {
            this.updateElement('hero-name', personal.name);
            this.updateElement('hero-title', personal.title);
            this.updateElement('hero-description', personal.tagline);
            this.updateAttribute('hero-image', 'src', personal.profileImage);
            this.updateAttribute('hero-github', 'href', social.github.url);
        }

        // Render stats
        const statsContainer = document.getElementById('stats-container');
        if (statsContainer && stats) {
            statsContainer.innerHTML = this.renderer.renderStats(stats);
        }

        // Render featured projects
        const projectsContainer = document.getElementById('featured-projects');
        if (projectsContainer && projects) {
            projectsContainer.innerHTML = this.renderer.renderProjects(projects, true);
        }
    }

    /**
     * Render about page
     */
    renderAboutPage() {
        const personal = this.data.personal?.personal;
        const languages = this.data.personal?.languages;
        const interests = this.data.personal?.interests;
        const education = this.data.education?.education;

        // Render bio
        if (personal) {
            this.updateAttribute('about-image', 'src', personal.profileImage);
            this.updateElement('about-name', personal.name);
            const bioContainer = document.getElementById('about-bio');
            if (bioContainer && personal.bio) {
                bioContainer.innerHTML = personal.bio.map(p => 
                    `<p class="bio-text">${p}</p>`
                ).join('');
                // Add skills
                bioContainer.innerHTML += `<p class="bio-text">My top skills include: <strong>${personal.topSkills.join('</strong>, <strong>')}</strong>.</p>`;
            }
        }

        // Render education timeline
        const educationContainer = document.getElementById('education-timeline');
        if (educationContainer && education) {
            educationContainer.innerHTML = this.renderer.renderEducationTimeline(education);
        }

        // Render languages
        const languagesContainer = document.getElementById('languages-container');
        if (languagesContainer && languages) {
            languagesContainer.innerHTML = this.renderer.renderLanguages(languages);
        }

        // Render interests
        const interestsContainer = document.getElementById('interests-container');
        if (interestsContainer && interests) {
            interestsContainer.innerHTML = this.renderer.renderInterests(interests);
        }
    }

    /**
     * Render contacts page
     */
    renderContactsPage() {
        const personal = this.data.personal?.personal;
        const social = this.data.personal?.social;

        // Render contact cards
        const contactContainer = document.getElementById('contact-cards');
        if (contactContainer && social) {
            contactContainer.innerHTML = this.renderer.renderContactCards(social);
        }

        // Render location
        if (personal) {
            this.updateElement('location-text', personal.location);
        }
    }

    /**
     * Render courses page
     */
    renderCoursesPage() {
        const coursesData = this.data.courses;
        const certifications = this.data.certifications?.certifications;

        // Render master's courses
        if (coursesData?.masters) {
            this.updateElement('masters-title', coursesData.masters.title);
            this.updateElement('masters-subtitle', coursesData.masters.subtitle);
            const mastersContainer = document.getElementById('masters-courses');
            if (mastersContainer) {
                mastersContainer.innerHTML = this.renderer.renderCourses(coursesData.masters.courses, 'master');
            }
        }

        // Render bachelor's courses
        if (coursesData?.bachelors) {
            this.updateElement('bachelors-title', coursesData.bachelors.title);
            this.updateElement('bachelors-subtitle', coursesData.bachelors.subtitle);
            const bachelorsContainer = document.getElementById('bachelors-courses');
            if (bachelorsContainer) {
                bachelorsContainer.innerHTML = this.renderer.renderCourses(coursesData.bachelors.courses, 'bachelor');
            }
        }

        // Render certifications
        const certsContainer = document.getElementById('certifications-container');
        if (certsContainer && certifications) {
            certsContainer.innerHTML = this.renderer.renderCertifications(certifications);
        }
    }

    /**
     * Render resources page
     */
    renderResourcesPage() {
        const featured = this.data.projects?.featured || [];
        const all = this.data.projects?.all || [];
        const allProjects = [...featured, ...all];

        const projectsContainer = document.getElementById('all-projects');
        if (projectsContainer && allProjects.length > 0) {
            projectsContainer.innerHTML = this.renderer.renderProjects(allProjects, true);
        }
    }

    /**
     * Render news page
     */
    renderNewsPage() {
        const news = this.data.news?.news;

        const newsContainer = document.getElementById('news-container');
        if (newsContainer && news) {
            newsContainer.innerHTML = this.renderer.renderNews(news);
        }
    }

    /**
     * Render CTA section
     */
    renderCTA() {
        const ctaContainer = document.getElementById('cta-container');
        const cta = this.data.site?.cta;

        if (ctaContainer && cta) {
            ctaContainer.innerHTML = this.renderer.renderCTA(cta);
        }
    }

    /**
     * Render footer
     */
    renderFooter() {
        const social = this.data.personal?.social;
        
        if (social) {
            this.updateAttribute('footer-github', 'href', social.github.url);
            this.updateAttribute('footer-linkedin', 'href', social.linkedin.url);
            this.updateAttribute('footer-email', 'href', `mailto:${social.email.address}`);
        }

        // Update year
        const yearSpan = document.getElementById('footer-year');
        if (yearSpan) {
            yearSpan.textContent = new Date().getFullYear();
        }
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
        const animatableSelectors = '.card, .project-card, .news-item, .course-card, .cert-card, .stat-card, .timeline-item';
        document.querySelectorAll(animatableSelectors).forEach(element => {
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

        // Smooth scroll for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }

    /**
     * Helper: Update element text content
     */
    updateElement(id, content) {
        const element = document.getElementById(id);
        if (element && content) {
            element.textContent = content;
        }
    }

    /**
     * Helper: Update element attribute
     */
    updateAttribute(id, attr, value) {
        const element = document.getElementById(id);
        if (element && value) {
            element.setAttribute(attr, value);
        }
    }

    /**
     * Get loaded data
     */
    getData(key) {
        return this.data[key] || null;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.PortfolioApp = new PortfolioApp();
    window.PortfolioApp.init();
});
