const axios = require('axios');
const fs = require('fs');
const path = require('path');

hexo.extend.tag.register('githubCard', async function(args) {
  hexo.log.debug(`GitHub Card: Processing tag with args: ${JSON.stringify(args)}`);
  
  const params = {};
  args.forEach(arg => {
    const [key, value] = arg.split(':');
    if (key && value) params[key] = value;
  });
  
  if (!params.user) {
    hexo.log.debug('GitHub Card: No user parameter provided');
    return '';
  }
  
  const height = params.height || '100';
  const width = params.width || '400';
  const align = params.repo ? (params.align || 'left') : (params.align || 'center');
  
  hexo.log.debug(`GitHub Card: Processing card for user ${params.user}, repo: ${params.repo || 'none'}`);
  
  // Get API token from config
  const config = hexo.config.github_card || {};
  if (config.api_token) {
    hexo.log.warn('GitHub Card: API token detected in configuration. Ensure this token is not committed to your repository!');
  }
  const headers = config.api_token ? { Authorization: `token ${config.api_token}` } : {};
  
  try {
    if (params.repo) {
      hexo.log.debug(`GitHub Card: Fetching repo data for ${params.user}/${params.repo}`);
      const response = await axios.get(`https://api.github.com/repos/${params.user}/${params.repo}`, { headers });
      const repository = response.data;
      hexo.log.debug(`GitHub Card: Successfully fetched repo ${repository.full_name}`);
      
      return `<div class="github-card github-repo-card${!params.width ? ' responsive' : ''}" style="${params.width ? `width: ${width}px;` : ''} min-height: ${height}px; text-align: ${align};">
        <div class="github-repo-icon">📖</div>
        <div class="github-repo-info">
          <h3><a href="${repository.html_url}" target="_blank">${repository.full_name}</a></h3>
          <p>${repository.description || ''}</p>
          <div class="github-repo-stats">
            <span class="github-repo-stat">⭐ ${repository.stargazers_count} Stars</span>
            <span class="github-repo-stat">🍴 ${repository.forks_count} Forks</span>
            <span class="github-repo-stat">Language: ${repository.language || 'N/A'}</span>
          </div>
        </div>
        <div class="github-repo-octocat"><svg height="32" aria-hidden="true" viewBox="0 0 24 24" version="1.1" width="32" data-view-component="true" class="octicon octicon-mark-github v-align-middle">
    <path d="M12 1C5.923 1 1 5.923 1 12c0 4.867 3.149 8.979 7.521 10.436.55.096.756-.233.756-.522 0-.262-.013-1.128-.013-2.049-2.764.509-3.479-.674-3.699-1.292-.124-.317-.66-1.293-1.127-1.554-.385-.207-.936-.715-.014-.729.866-.014 1.485.797 1.691 1.128.99 1.663 2.571 1.196 3.204.907.096-.715.385-1.196.701-1.471-2.448-.275-5.005-1.224-5.005-5.432 0-1.196.426-2.186 1.128-2.956-.111-.275-.496-1.402.11-2.915 0 0 .921-.288 3.024 1.128a10.193 10.193 0 0 1 2.75-.371c.936 0 1.871.123 2.75.371 2.104-1.43 3.025-1.128 3.025-1.128.605 1.513.221 2.64.111 2.915.701.77 1.127 1.747 1.127 2.956 0 4.222-2.571 5.157-5.019 5.432.399.344.743 1.004.743 2.035 0 1.471-.014 2.654-.014 3.025 0 .289.206.632.756.522C19.851 20.979 23 16.854 23 12c0-6.077-4.922-11-11-11Z"></path>
</svg></div>
      </div>`;
    } else {
      hexo.log.debug(`GitHub Card: Fetching user data for ${params.user}`);
      const [userResponse, reposResponse, eventsResponse] = await Promise.all([
        axios.get(`https://api.github.com/users/${params.user}`, { headers }),
        axios.get(`https://api.github.com/users/${params.user}/repos?per_page=100`, { headers }),
        axios.get(`https://api.github.com/users/${params.user}/events/public?per_page=100`, { headers })
      ]);
      
      const user = userResponse.data;
      const repos = reposResponse.data;
      const events = eventsResponse.data;
      
      // Calculate total stars
      const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
      hexo.log.debug(`GitHub Card: Total stars calculated: ${totalStars} from ${repos.length} repos`);
      
      // Calculate contributions (push events in the last year)
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const contributions = events.filter(event => 
        event.type === 'PushEvent' && new Date(event.created_at) > oneYearAgo
      ).length;
      
      // Calculate pull requests (from events)
      const pullRequests = events.filter(event => 
        event.type === 'PullRequestEvent'
      ).length;
      
      // Calculate issues (from events)
      const issues = events.filter(event => 
        event.type === 'IssuesEvent'
      ).length;
      
      // Get language statistics
      const languages = {};
      repos.forEach(repo => {
        if (repo.language) {
          languages[repo.language] = (languages[repo.language] || 0) + 1;
        }
      });
      
      const totalRepos = Object.values(languages).reduce((sum, count) => sum + count, 0);
      const sortedLanguages = Object.entries(languages)
        .sort(([,a], [,b]) => b - a);
      
      const top5Languages = sortedLanguages.slice(0, 5);
      const otherCount = sortedLanguages.slice(5).reduce((sum, [,count]) => sum + count, 0);
      
      const languageColors = {
        'JavaScript': '#f1e05a',
        'TypeScript': '#2b7489',
        'Python': '#3572A5',
        'Java': '#b07219',
        'C++': '#f34b7d',
        'C#': '#239120',
        'PHP': '#4F5D95',
        'Ruby': '#701516',
        'Go': '#00ADD8',
        'Rust': '#dea584',
        'Swift': '#ffac45',
        'Kotlin': '#F18E33',
        'Scala': '#c22d40',
        'HTML': '#e34c26',
        'CSS': '#563d7c',
        'Shell': '#89e051',
        'C': '#555555',
        'Objective-C': '#438eff',
        'R': '#198CE7',
        'Dart': '#00B4AB'
      };
      
      const languageStats = top5Languages.map(([lang, count]) => ({
        name: lang,
        count,
        percentage: ((count / totalRepos) * 100).toFixed(1),
        color: languageColors[lang] || '#8cc8ff'
      }));
      
      if (otherCount > 0) {
        languageStats.push({
          name: 'Other',
          count: otherCount,
          percentage: ((otherCount / totalRepos) * 100).toFixed(1),
          color: '#cccccc'
        });
      }
      
      hexo.log.debug(`GitHub Card: Successfully fetched user ${user.login}`);
      
      return `<div class="github-card${!params.width ? ' responsive' : ''}" style="${params.width ? `width: ${width}px;` : ''} min-height: ${height}px; text-align: ${align};">
        <div class="github-card-header">
          <img src="${user.avatar_url}" width="80" height="80" class="github-card-avatar">
          <h3 class="github-card-name"><a href="${user.html_url}" target="_blank">${user.name || user.login}</a></h3>
          <p class="github-card-username">@${user.login}</p>
          <div class="github-card-details">
            ${user.location ? `<p class="github-card-location">📍 ${user.location}</p>` : ''}
            ${user.blog ? `<p class="github-card-blog">🔗 <a href="${user.blog.startsWith('http') ? user.blog : 'https://' + user.blog}" target="_blank">${user.blog}</a></p>` : ''}
            ${user.bio ? `<p class="github-card-bio">${user.bio}</p>` : ''}
          </div>
        </div>
        <div class="github-card-stats">
          <div class="github-card-stat">
            <div class="github-card-stat-number">📁 ${user.public_repos}</div>
            <div class="github-card-stat-label">Repositories</div>
          </div>
          <div class="github-card-stat">
            <div class="github-card-stat-number">⭐ ${totalStars || 0}</div>
            <div class="github-card-stat-label">Stars</div>
          </div>
          <div class="github-card-stat">
            <div class="github-card-stat-number">📈 ${contributions}</div>
            <div class="github-card-stat-label">Commits</div>
          </div>
          <div class="github-card-stat">
            <div class="github-card-stat-number">👥 ${user.followers}</div>
            <div class="github-card-stat-label">Followers</div>
          </div>
          <div class="github-card-stat">
            <div class="github-card-stat-number">🔄 ${pullRequests}</div>
            <div class="github-card-stat-label">Pull Requests</div>
          </div>
          <div class="github-card-stat">
            <div class="github-card-stat-number">❗ ${issues}</div>
            <div class="github-card-stat-label">Issues</div>
          </div>
        </div>
        ${languageStats.length > 0 ? `<div class="github-card-languages">
          <div class="github-card-language-bar">
            ${languageStats.map(lang => `<div class="github-card-language-segment" style="width: ${lang.percentage}%; background-color: ${lang.color};"></div>`).join('')}
          </div>
          <div class="github-card-languages-list">
            ${languageStats.map(lang => `<span class="github-card-language-item">
              <span class="github-card-language-dot" style="background-color: ${lang.color};"></span>
              ${lang.name} ${lang.percentage}%
            </span>`).join('')}
          </div>
        </div>` : ''}
      </div>`;
    }
  } catch (error) {
    hexo.log.error(`GitHub Card: API error for ${params.user}/${params.repo || ''}: ${error.message}`);
    return `<div class="github-card-error">Error loading GitHub data for ${params.user}${params.repo ? '/' + params.repo : ''}</div>`;
  }
}, { async: true });

// Inject CSS styles
hexo.extend.filter.register('after_generate', function() {
  // Check if CSS injection is disabled in config
  const config = hexo.config.github_card || {};
  if (config.inject_css === false) {
    return;
  }
  config.priority = config.priority !== undefined ? config.priority : 10;
  
  const cssPath = path.join(__dirname, 'github-card.css');
  let css;
  try {
    css = fs.readFileSync(cssPath, 'utf8');
  } catch (error) {
    hexo.log.error(`GitHub Card: Failed to load CSS file: ${error.message}`);
    return;
  }
  
  const route = hexo.route;
  const routeList = route.list();
  const routes = routeList.filter(hpath => hpath.endsWith('.html'));
  
  const htmls = {};
  return Promise.all(routes.map(hpath => {
    return new Promise((resolve, reject) => {
      const contents = route.get(hpath);
      let htmlTxt = '';
      contents.on('data', (chunk) => (htmlTxt += chunk));
      contents.on('end', () => {
        if (htmlTxt.includes('github-card') && !htmlTxt.includes('github-card-styles')) {
          const newContent = htmlTxt.replace('</head>', `<style id="github-card-styles">${css}</style></head>`);
          htmls[hpath] = newContent;
        }
        resolve();
      });
    });
  }))
  .then(() => {
    const htmlPaths = Object.keys(htmls);
    for (const hpath of htmlPaths) {
      route.set(hpath, htmls[hpath]);
    }
  });
}, hexo.config.github_card?.priority ?? 10);