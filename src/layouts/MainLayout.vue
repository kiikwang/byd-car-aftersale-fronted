<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const menuRoutes = computed(() => {
  const layout = router.getRoutes().find((r) => r.path === '/')
  return (
    layout?.children?.filter(
      (r) => !r.meta?.hidden && userStore.allowedRoutes.includes(r.path as string),
    ) || []
  )
})

const activeMenu = computed(() => '/' + (route.path.split('/')[1] || 'dashboard'))

async function handleLogout() {
  await userStore.logout()
  router.push('/login')
}
</script>

<template>
  <el-container class="main-layout">
    <el-aside width="240px" class="sidebar">
      <div class="logo">
        <div class="logo-mark">BYD</div>
        <div class="logo-text">
          <span class="title">比亚迪售后</span>
          <span class="sub">智能维修管理</span>
        </div>
      </div>

      <div class="sidebar-user">
        <el-avatar :size="36" class="avatar">{{ userStore.realName.charAt(0) }}</el-avatar>
        <div class="user-meta">
          <span class="name">{{ userStore.realName }}</span>
          <el-tag size="small" effect="dark" class="role-tag">{{ userStore.roleLabel }}</el-tag>
        </div>
      </div>

      <el-menu
        :default-active="activeMenu"
        router
        class="sidebar-menu"
      >
        <el-menu-item v-for="item in menuRoutes" :key="item.path" :index="`/${item.path}`">
          <el-icon v-if="item.meta?.icon">
            <component :is="item.meta.icon" />
          </el-icon>
          <span>{{ item.meta?.title }}</span>
        </el-menu-item>
      </el-menu>

      <div class="sidebar-footer">
        <div class="ev-strip">
          <el-icon><Lightning /></el-icon>
          <span>新能源售后服务</span>
        </div>
      </div>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item v-if="route.meta.title">{{ route.meta.title }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-dropdown>
            <span class="user-info">
              <span>{{ userStore.username }}</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item disabled>角色：{{ userStore.roleLabel }}</el-dropdown-item>
                <el-dropdown-item divided @click="handleLogout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped lang="scss">
.main-layout {
  height: 100vh;
}

.sidebar {
  background: linear-gradient(180deg, #1a1a1a 0%, #2d1518 100%);
  display: flex;
  flex-direction: column;
  border-right: 3px solid #e60012;

  .logo {
    height: 64px;
    display: flex;
    align-items: center;
    padding: 0 16px;
    gap: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);

    .logo-mark {
      width: 44px;
      height: 44px;
      background: #e60012;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 14px;
      color: #fff;
      letter-spacing: 1px;
    }

    .logo-text {
      display: flex;
      flex-direction: column;

      .title {
        color: #fff;
        font-size: 15px;
        font-weight: 600;
      }

      .sub {
        color: rgba(255, 255, 255, 0.5);
        font-size: 11px;
      }
    }
  }

  .sidebar-user {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);

    .avatar {
      background: #e60012;
      color: #fff;
    }

    .user-meta {
      .name {
        display: block;
        color: #fff;
        font-size: 14px;
        margin-bottom: 4px;
      }

      .role-tag {
        background: rgba(230, 0, 18, 0.8);
        border: none;
      }
    }
  }

  .sidebar-menu {
    flex: 1;
    border-right: none;
    background: transparent;

    :deep(.el-menu-item) {
      color: rgba(255, 255, 255, 0.65);
      margin: 4px 8px;
      border-radius: 8px;

      &:hover {
        background: rgba(230, 0, 18, 0.15);
        color: #fff;
      }

      &.is-active {
        background: linear-gradient(90deg, #e60012, #c4000f);
        color: #fff;
      }
    }
  }

  .sidebar-footer {
    padding: 12px 16px;

    .ev-strip {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: rgba(0, 166, 81, 0.15);
      border-radius: 6px;
      color: #00d46a;
      font-size: 12px;
    }
  }
}

.header {
  height: 56px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  border-bottom: 2px solid #f0f0f0;

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    font-size: 14px;
    color: #595959;
  }
}

.main-content {
  padding: 20px;
  background: #f5f5f5;
  overflow-y: auto;
}
</style>
