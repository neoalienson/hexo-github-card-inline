const axios = require('axios');
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

jest.mock('axios');
const mockedAxios = axios;

// Mock hexo object
global.hexo = {
  extend: {
    tag: {
      register: jest.fn()
    },
    filter: {
      register: jest.fn()
    }
  },
  log: {
    debug: jest.fn(),
    error: jest.fn()
  },
  config: {}
};

describe('hexo-github-card-inline', () => {
  let tagFunction;
  let pluginModule;

  beforeAll(() => {
    pluginModule = require('../index');
    tagFunction = hexo.extend.tag.register.mock.calls[0][1];
  });

  beforeEach(() => {
    hexo.base_dir = path.join(__dirname, '..');
  });

  afterEach(() => {
    jest.clearAllMocks();
    hexo.config = {};
    pluginModule.cache.clear();
    
    const cacheDir = path.join(hexo.base_dir, '.github-card-cache');
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  describe('user card', () => {
    it('should render user card with language statistics', async () => {
      const mockUser = {
        login: 'neoalienson',
        name: 'Neo Alienson',
        avatar_url: 'https://github.com/avatar.jpg',
        html_url: 'https://github.com/neoalienson',
        bio: 'Developer',
        followers: 100,
        public_repos: 25
      };

      const mockRepos = [
        { language: 'JavaScript', stargazers_count: 5 },
        { language: 'JavaScript', stargazers_count: 3 },
        { language: 'Python', stargazers_count: 2 },
        { language: 'TypeScript', stargazers_count: 1 },
        { language: null, stargazers_count: 0 }
      ];

      const mockEvents = [
        { type: 'PushEvent', created_at: new Date().toISOString() },
        { type: 'PullRequestEvent', created_at: new Date().toISOString() }
      ];

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockUser })
        .mockResolvedValueOnce({ data: mockRepos })
        .mockResolvedValueOnce({ data: mockEvents });

      const result = await tagFunction(['user:neoalienson']);
      
      expect(result).to.include('github-card');
      expect(result).to.include('Neo Alienson');
      expect(result).to.include('Developer');
      expect(result).to.include('👥 100');
      expect(result).to.include('github-card-languages');
      expect(result).to.include('JavaScript');
      expect(result).to.include('50.0%');
      expect(result).to.include('Python');
      expect(result).to.include('25.0%');
      expect(result).to.include('github-card-language-bar');
      expect(result).to.include('#f1e05a');
    });

    it('should handle "Other" languages when more than 5', async () => {
      const mockUser = {
        login: 'testuser',
        name: 'Test User',
        avatar_url: 'https://github.com/avatar.jpg',
        html_url: 'https://github.com/testuser',
        followers: 50,
        public_repos: 10
      };

      const mockRepos = [
        { language: 'JavaScript', stargazers_count: 1 },
        { language: 'Python', stargazers_count: 1 },
        { language: 'Java', stargazers_count: 1 },
        { language: 'Go', stargazers_count: 1 },
        { language: 'Rust', stargazers_count: 1 },
        { language: 'C++', stargazers_count: 1 },
        { language: 'Ruby', stargazers_count: 1 }
      ];

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockUser })
        .mockResolvedValueOnce({ data: mockRepos })
        .mockResolvedValueOnce({ data: [] });

      const result = await tagFunction(['user:testuser']);
      
      expect(result).to.include('Other');
      expect(result).to.include('28.6%');
      expect(result).to.include('#cccccc');
    });
  });

  describe('repo card', () => {
    it('should render repo card', async () => {
      const mockRepo = {
        full_name: 'neoalienson/test-repo',
        html_url: 'https://github.com/neoalienson/test-repo',
        description: 'Test repository',
        stargazers_count: 10,
        forks_count: 5,
        language: 'JavaScript'
      };

      mockedAxios.get.mockResolvedValue({ data: mockRepo });

      const result = await tagFunction(['user:neoalienson', 'repo:test-repo']);
      
      expect(result).to.include('github-card');
      expect(result).to.include('neoalienson/test-repo');
      expect(result).to.include('Test repository');
      expect(result).to.include('⭐ 10');
      expect(result).to.include('Language: JavaScript');
    });
  });

  describe('error handling', () => {
    it('should handle API errors', async () => {
      mockedAxios.get.mockRejectedValue(new Error('API Error'));

      const result = await tagFunction(['user:invalid']);
      
      expect(result).to.include('github-card-error');
      expect(result).to.include('Error loading GitHub data');
    });

    it('should handle 404 errors', async () => {
      const error = new Error('Not Found');
      error.response = { status: 404 };
      mockedAxios.get.mockRejectedValue(error);

      const result = await tagFunction(['user:nonexistent']);
      
      expect(result).to.include('github-card-error');
      expect(hexo.log.error.mock.calls.some(call => call[0].includes('404 Not Found'))).to.be.true;
    });

    it('should handle invalid arguments', async () => {
      const result = await tagFunction([]);
      expect(result).to.equal('');
    });

    it('should use default language color for unknown languages', async () => {
      const mockUser = {
        login: 'testuser',
        avatar_url: 'https://github.com/avatar.jpg',
        html_url: 'https://github.com/testuser',
        followers: 10,
        public_repos: 1
      };

      const mockRepos = [{ language: 'UnknownLang', stargazers_count: 1 }];

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockUser })
        .mockResolvedValueOnce({ data: mockRepos })
        .mockResolvedValueOnce({ data: [] });

      const result = await tagFunction(['user:testuser']);
      
      expect(result).to.include('UnknownLang');
      expect(result).to.include('#8cc8ff');
    });
  });

  describe('caching', () => {
    it('should cache API responses when enabled', async () => {
      hexo.config.github_card = { cache_enabled: true, cache_ttl: 3600 };
      
      const mockRepo = {
        full_name: 'user/repo',
        html_url: 'https://github.com/user/repo',
        description: 'Test',
        stargazers_count: 10,
        forks_count: 5,
        language: 'JavaScript'
      };

      mockedAxios.get.mockResolvedValue({ data: mockRepo });

      await tagFunction(['user:user', 'repo:repo']);
      await tagFunction(['user:user', 'repo:repo']);
      
      expect(mockedAxios.get.mock.calls.length).to.equal(1);
    });

    it('should not cache when disabled', async () => {
      hexo.config.github_card = { cache_enabled: false };
      
      const mockRepo = {
        full_name: 'user/repo',
        html_url: 'https://github.com/user/repo',
        description: 'Test',
        stargazers_count: 10,
        forks_count: 5,
        language: 'JavaScript'
      };

      mockedAxios.get.mockResolvedValue({ data: mockRepo });

      await tagFunction(['user:user', 'repo:repo']);
      await tagFunction(['user:user', 'repo:repo']);
      
      expect(mockedAxios.get.mock.calls.length).to.equal(2);
    });

    it('should invalidate cache after TTL expires', async () => {
      hexo.config.github_card = { cache_enabled: true, cache_ttl: 0.02 };
      
      const mockRepo = {
        full_name: 'user/repo',
        html_url: 'https://github.com/user/repo',
        description: 'Test',
        stargazers_count: 10,
        forks_count: 5,
        language: 'JavaScript'
      };

      mockedAxios.get.mockResolvedValue({ data: mockRepo });

      await tagFunction(['user:user', 'repo:repo']);
      await new Promise(resolve => setTimeout(resolve, 30));
      await tagFunction(['user:user', 'repo:repo']);
      
      expect(mockedAxios.get.mock.calls.length).to.equal(2);
    });

    it('should persist cache to disk when enabled', async () => {
      hexo.config.github_card = { cache_enabled: true, cache_persist: true };
      
      const mockRepo = {
        full_name: 'user/repo',
        html_url: 'https://github.com/user/repo',
        description: 'Test',
        stargazers_count: 10,
        forks_count: 5,
        language: 'JavaScript'
      };

      mockedAxios.get.mockResolvedValue({ data: mockRepo });

      await tagFunction(['user:user', 'repo:repo']);
      
      const cacheDir = path.join(hexo.base_dir, '.github-card-cache');
      expect(fs.existsSync(cacheDir)).to.be.true;
      expect(fs.readdirSync(cacheDir).length).to.be.greaterThan(0);
    });

    it('should load cache from disk on subsequent builds', async () => {
      hexo.config.github_card = { cache_enabled: true, cache_persist: true };
      
      const mockRepo = {
        full_name: 'user/repo',
        html_url: 'https://github.com/user/repo',
        description: 'Test',
        stargazers_count: 10,
        forks_count: 5,
        language: 'JavaScript'
      };

      mockedAxios.get.mockResolvedValue({ data: mockRepo });

      await tagFunction(['user:user', 'repo:repo']);
      pluginModule.cache.clear();
      await tagFunction(['user:user', 'repo:repo']);
      
      expect(mockedAxios.get.mock.calls.length).to.equal(1);
    });
  });
});