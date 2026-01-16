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
            'index': ['projects', 'courses', 'certifications', 'education', 'work'],
            'about': [],
            'contacts': [],
            'courses': ['courses', 'certifications'],
            'resources': ['projects'],
            'journey': ['education', 'work']
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
            'journey': () => this.renderJourneyPage()
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

        // Get all data
        const allProjects = this.data.projects?.projects || [];
        const mastersCourses = this.data.courses?.masters?.courses || [];
        const bachelorsCourses = this.data.courses?.bachelors?.courses || [];
        const allCertifications = this.data.certifications?.certifications || [];
        const allEducation = this.data.education?.education || [];
        const allWork = this.data.work?.work || [];

        // Render featured section
        const featuredContainer = document.getElementById('featured-container');
        if (featuredContainer) {
            const featuredProjects = allProjects.filter(p => p.featured === true);
            const featuredCourses = [...mastersCourses, ...bachelorsCourses].filter(c => c.featured === true);
            const featuredCerts = allCertifications.filter(c => c.featured === true);
            const featuredEducation = allEducation.filter(e => e.featured === true);
            const featuredWork = allWork.filter(w => w.featured === true);

            let html = '';
            
            if (featuredProjects.length > 0) {
                html += this.renderer.renderFeaturedProjects(featuredProjects);
            }
            if (featuredCourses.length > 0) {
                html += this.renderer.renderFeaturedCourses(featuredCourses);
            }
            if (featuredCerts.length > 0) {
                html += this.renderer.renderFeaturedCertifications(featuredCerts);
            }
            if (featuredEducation.length > 0) {
                html += this.renderer.renderFeaturedEducation(featuredEducation);
            }
            if (featuredWork.length > 0) {
                html += this.renderer.renderFeaturedWork(featuredWork);
            }

            featuredContainer.innerHTML = html || '<p class="text-muted">No featured items yet.</p>';
        }

        // Render news section
        const newsContainer = document.getElementById('news-container');
        if (newsContainer) {
            const newsProjects = allProjects.filter(p => p.news === true);
            const newsCourses = [...mastersCourses, ...bachelorsCourses].filter(c => c.news === true);
            const newsCerts = allCertifications.filter(c => c.news === true);
            const newsEducation = allEducation.filter(e => e.news === true);
            const newsWork = allWork.filter(w => w.news === true);

            let html = '';
            
            if (newsProjects.length > 0) {
                html += this.renderer.renderFeaturedProjects(newsProjects);
            }
            if (newsCourses.length > 0) {
                html += this.renderer.renderFeaturedCourses(newsCourses);
            }
            if (newsCerts.length > 0) {
                html += this.renderer.renderFeaturedCertifications(newsCerts);
            }
            if (newsEducation.length > 0) {
                html += this.renderer.renderFeaturedEducation(newsEducation);
            }
            if (newsWork.length > 0) {
                html += this.renderer.renderFeaturedWork(newsWork);
            }

            newsContainer.innerHTML = html || '<p class="text-muted">No news updates yet.</p>';
        }
    }

    /**
     * Render about page
     */
    renderAboutPage() {
        const personal = this.data.personal?.personal;
        const languages = this.data.personal?.languages;
        const interests = this.data.personal?.interests;

        // Render bio
        if (personal) {
            this.updateAttribute('about-image', 'src', personal.profileImage);
            this.updateElement('about-name', personal.name);
            const bioContainer = document.getElementById('about-bio');
            if (bioContainer && personal.bio) {
                bioContainer.innerHTML = personal.bio.map(p => 
                    `<p class="bio-text">${p}</p>`
                ).join('');
            }
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
     * Render journey page
     */
    renderJourneyPage() {
        const education = this.data.education?.education;
        const work = this.data.work?.work;

        // Render work timeline
        const workContainer = document.getElementById('work-timeline');
        if (workContainer) {
            if (work && work.length > 0) {
                workContainer.innerHTML = this.renderer.renderWorkTimeline(work);
            } else {
                workContainer.innerHTML = '<p class="text-muted">Work experience coming soon...</p>';
            }
        }

        // Render education timeline
        const educationContainer = document.getElementById('education-timeline');
        if (educationContainer && education) {
            educationContainer.innerHTML = this.renderer.renderEducationTimeline(education);
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
        const allProjects = this.data.projects?.projects || [];

        const projectsContainer = document.getElementById('all-projects');
        if (projectsContainer && allProjects.length > 0) {
            projectsContainer.innerHTML = this.renderer.renderProjects(allProjects, true);
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
