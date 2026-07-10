<script setup lang="ts">

import { computed, ref } from 'vue'

import { useRouter } from 'vue-router'

import { ElMessage } from 'element-plus'

import { useUserStore } from '@/stores/user'

import { ROLE_LIST, type UserRole } from '@/constants/roles'



const router = useRouter()

const userStore = useUserStore()



const DEMO_ACCOUNTS: Record<UserRole, string> = {

  OWNER: 'owner001',

  ADVISOR: 'advisor001',

  TECHNICIAN: 'tech001',

  PART_ADMIN: 'part001',

  SERVICE_MANAGER: 'manager001',

  ADMIN: 'admin001',

}



const DEMO_PASSWORD = '12345678'



type LoginTab = 'OWNER' | 'STAFF'

const activeLoginTab = ref<LoginTab>('OWNER')

const selectedRole = ref<UserRole>('OWNER')

const form = ref({ username: DEMO_ACCOUNTS.OWNER, password: DEMO_PASSWORD })

const loading = ref(false)

const ownerRoles = computed(() => ROLE_LIST.filter((role) => role.value === 'OWNER'))

const staffRoles = computed(() => ROLE_LIST.filter((role) => role.value !== 'OWNER'))

const visibleRoles = computed(() => activeLoginTab.value === 'OWNER' ? ownerRoles.value : staffRoles.value)

const loginHint = computed(() =>
  activeLoginTab.value === 'OWNER'
    ? '车主可预约维保、查看维修进度和结算账单'
    : '售后顾问、技师、备件员、服务经理和管理员由此登录',
)

function changeLoginTab(tab: string | number) {
  const nextTab = tab === 'STAFF' ? 'STAFF' : 'OWNER'
  activeLoginTab.value = nextTab
  selectRole(nextTab === 'OWNER' ? 'OWNER' : 'ADVISOR')
}



function selectRole(role: UserRole) {

  selectedRole.value = role

  form.value.username = DEMO_ACCOUNTS[role]

  form.value.password = DEMO_PASSWORD

}



async function handleLogin() {

  if (!form.value.username || !form.value.password) {

    ElMessage.warning('请输入用户名和密码')

    return

  }

  loading.value = true

  try {

    const ok = await userStore.login(form.value.username, form.value.password)

    if (!ok) return

    if (userStore.role !== selectedRole.value) {

      ElMessage.warning(`账号实际角色为「${userStore.roleLabel}」，已按账号权限进入系统`)

    }

    ElMessage.success(`欢迎，${userStore.roleLabel}`)

    await router.push('/dashboard')

  } catch (e: any) {

    ElMessage.error(e?.message || '登录失败，请检查账号和密码')

  } finally {

    loading.value = false

  }

}



function goRegister() {

  router.push('/register')

}

</script>



<template>

  <div class="login-page">

    <div class="login-bg">

      <div class="bg-pattern" />

      <div class="bg-car-silhouette" />

    </div>



    <div class="login-container">

      <div class="brand-panel">

        <div class="byd-logo">

          <span class="logo-text">BYD</span>

          <span class="logo-sub">比亚迪汽车</span>

        </div>

        <h1>售后智能维修管理系统</h1>

        <p class="slogan">科技 · 绿色 · 明天</p>

        <div class="feature-tags">

          <span><el-icon><Van /></el-icon> 车辆档案</span>

          <span><el-icon><Cpu /></el-icon> Agent 诊断</span>

          <span><el-icon><Lightning /></el-icon> 电池预警</span>

          <span><el-icon><DataAnalysis /></el-icon> 运营看板</span>

        </div>

        <div class="ev-badge">

          <el-icon><Lightning /></el-icon>

          新能源专属售后服务平台

        </div>

      </div>



      <div class="login-card">

        <h2>系统登录</h2>

        <p class="hint">{{ loginHint }}</p>

        <el-tabs v-model="activeLoginTab" class="login-tabs" stretch @tab-change="changeLoginTab">
          <el-tab-pane label="车主登录" name="OWNER" />
          <el-tab-pane label="内部人员登录" name="STAFF" />
        </el-tabs>



        <div class="role-grid" :class="{ owner: activeLoginTab === 'OWNER' }">

          <button

            v-for="role in visibleRoles"

            :key="role.value"

            type="button"

            class="role-card"

            :class="{ active: selectedRole === role.value }"

            @click="selectRole(role.value)"

          >

            <span class="role-label">{{ role.label }}</span>

            <span class="role-desc">{{ role.desc }}</span>

            <span class="role-account">{{ DEMO_ACCOUNTS[role.value] }}</span>

          </button>

        </div>



        <el-form :model="form" @submit.prevent="handleLogin">

          <el-form-item>

            <el-input v-model="form.username" placeholder="用户名" size="large" prefix-icon="User" />

          </el-form-item>

          <el-form-item>

            <el-input

              v-model="form.password"

              type="password"

              placeholder="密码"

              size="large"

              prefix-icon="Lock"

              show-password

              @keyup.enter="handleLogin"

            />

          </el-form-item>

          <el-button type="primary" size="large" :loading="loading" class="login-btn" @click="handleLogin">

            登 录

          </el-button>

        </el-form>



        <p v-if="activeLoginTab === 'OWNER'" class="register-link">

          还没有账号？

          <a href="javascript:void(0)" @click="goRegister">车主注册</a>

        </p>

      </div>

    </div>

  </div>

</template>



<style scoped lang="scss">

.login-page {

  min-height: 100vh;

  position: relative;

  display: flex;

  align-items: center;

  justify-content: center;

  background: #1a1a1a;

  overflow: hidden;

}



.login-bg {

  position: absolute;

  inset: 0;



  .bg-pattern {

    position: absolute;

    inset: 0;

    background:

      radial-gradient(ellipse at 20% 50%, rgba(230, 0, 18, 0.15) 0%, transparent 50%),

      radial-gradient(ellipse at 80% 20%, rgba(0, 166, 81, 0.1) 0%, transparent 40%),

      linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%);

  }



  .bg-car-silhouette {

    position: absolute;

    bottom: -60px;

    left: 50%;

    transform: translateX(-50%);

    width: 80%;

    height: 200px;

    background: linear-gradient(to top, rgba(230, 0, 18, 0.08), transparent);

    border-radius: 50% 50% 0 0;

  }

}



.login-container {

  position: relative;

  z-index: 1;

  display: flex;

  gap: 48px;

  align-items: flex-start;

  padding: 40px;

  max-width: 1180px;

  width: 100%;

}



.brand-panel {

  flex: 1;

  color: #fff;

  padding-top: 12px;



  .byd-logo {

    display: flex;

    align-items: baseline;

    gap: 12px;

    margin-bottom: 24px;



    .logo-text {

      font-size: 48px;

      font-weight: 800;

      color: #e60012;

      letter-spacing: 4px;

    }



    .logo-sub {

      font-size: 20px;

      font-weight: 500;

      opacity: 0.9;

    }

  }



  h1 {

    font-size: 32px;

    font-weight: 600;

    margin-bottom: 12px;

    line-height: 1.3;

  }



  .slogan {

    font-size: 16px;

    color: rgba(255, 255, 255, 0.6);

    margin-bottom: 32px;

    letter-spacing: 8px;

  }



  .feature-tags {

    display: flex;

    flex-wrap: wrap;

    gap: 12px;

    margin-bottom: 32px;



    span {

      display: flex;

      align-items: center;

      gap: 6px;

      padding: 8px 16px;

      background: rgba(255, 255, 255, 0.08);

      border: 1px solid rgba(255, 255, 255, 0.12);

      border-radius: 20px;

      font-size: 13px;

    }

  }



  .ev-badge {

    display: inline-flex;

    align-items: center;

    gap: 8px;

    padding: 10px 20px;

    background: linear-gradient(90deg, rgba(0, 166, 81, 0.3), rgba(0, 166, 81, 0.1));

    border: 1px solid rgba(0, 166, 81, 0.4);

    border-radius: 8px;

    color: #00d46a;

    font-size: 14px;

  }

}



.login-card {

  width: 460px;

  background: #fff;

  padding: 28px 32px 32px;

  border-radius: 16px;

  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);



  h2 {

    font-size: 22px;

    margin-bottom: 6px;

    color: #1a1a1a;

  }



  .hint {

    color: #8c8c8c;

    font-size: 13px;

    margin-bottom: 16px;

    line-height: 1.5;

  }

  .login-tabs {
    margin-bottom: 14px;
  }



  .role-grid {

    display: grid;

    grid-template-columns: repeat(2, 1fr);

    gap: 8px;

    margin-bottom: 16px;

    &.owner {
      grid-template-columns: 1fr;
    }

  }



  .role-card {

    text-align: left;

    border: 1px solid #e8e8e8;

    background: #fafafa;

    border-radius: 10px;

    padding: 10px 12px;

    cursor: pointer;

    transition: all 0.15s;



    &.active {

      border-color: #e60012;

      background: #fff5f5;

      box-shadow: 0 0 0 1px rgba(230, 0, 18, 0.15);

    }



    .role-label {

      display: block;

      font-weight: 600;

      font-size: 13px;

      color: #262626;

    }



    .role-desc {

      display: block;

      font-size: 11px;

      color: #8c8c8c;

      margin: 2px 0 4px;

      line-height: 1.3;

    }



    .role-account {

      display: block;

      font-size: 11px;

      color: #e60012;

      font-family: monospace;

    }

  }



  .login-btn {

    width: 100%;

    height: 44px;

    font-size: 16px;

    background: #e60012;

    border-color: #e60012;



    &:hover {

      background: #c4000f;

      border-color: #c4000f;

    }

  }



  .register-link {

    margin-top: 14px;

    text-align: center;

    font-size: 13px;

    color: #8c8c8c;



    a {

      color: #e60012;

      text-decoration: none;

      margin-left: 4px;

    }

  }

}



@media (max-width: 900px) {

  .login-container {

    flex-direction: column;

  }



  .brand-panel {

    text-align: center;



    .feature-tags {

      justify-content: center;

    }

  }



  .login-card {

    width: 100%;

  }

}

</style>

