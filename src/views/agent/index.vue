<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import { useUserStore } from '@/stores/user'
import { usePermissions } from '@/composables/usePermissions'
import type { DiagnosisResult, Vehicle, BatteryHealthRecord, FaultRecord, WorkOrder } from '@/types'
import { agentApi, batteryApi, faultApi, vehicleApi, workOrderApi } from '@/api'
import { buildVehicleListParams } from '@/composables/useScopedVehicles'
import { buildAgentInputFromFault, parseFaultDescription } from '@/utils/fault-form'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const { can } = usePermissions()
const loading = ref(false)
const result = ref<DiagnosisResult | null>(null)
const scriptLoading = ref(false)
const quoteLoading = ref(false)
const customerScript = ref<any>(null)
const repairQuote = ref<any>(null)

const vehicles = ref<Vehicle[]>([])
const batteries = ref<BatteryHealthRecord[]>([])
const faults = ref<FaultRecord[]>([])
const myOrders = ref<WorkOrder[]>([])
const allOrders = ref<WorkOrder[]>([])

const selectedFaultId = ref<number | null>(null)

const selectedFault = computed(() =>
  faults.value.find((f) => f.faultId === selectedFaultId.value),
)

const parsedFault = computed(() =>
  parseFaultDescription(selectedFault.value?.faultDescription || ''),
)

const vehicle = computed(() =>
  vehicles.value.find((v) => v.vin === selectedFault.value?.vin),
)

const battery = computed(() => {
  const vin = selectedFault.value?.vin
  if (!vin) return undefined
  return batteries.value
    .filter((b) => b.vin === vin)
    .sort((a, b) => String(b.detectTime || '').localeCompare(String(a.detectTime || '')))[0]
})

type DiagnoseOption = {
  key: string
  faultId: number
  workOrderId?: number
  label: string
  group: 'mine' | 'order' | 'fault'
}

const diagnoseOptions = computed<DiagnoseOption[]>(() => {
  const options: DiagnoseOption[] = []
  const usedFaultIds = new Set<number>()

  const pushOrder = (o: WorkOrder, group: 'mine' | 'order') => {
    if (!o.faultId || usedFaultIds.has(o.faultId)) return
    const fault = faults.value.find((f) => f.faultId === o.faultId)
    if (!fault) return
    usedFaultIds.add(o.faultId)
    const plate = vehicles.value.find((v) => v.vin === fault.vin)?.licensePlate || fault.vin
    options.push({
      key: `wo-${o.workOrderId}`,
      faultId: o.faultId,
      workOrderId: o.workOrderId,
      group,
      label: `${o.workOrderNo} · ${plate} · ${o.status}`,
    })
  }

  myOrders.value
    .filter((o) => !['COMPLETED', 'CANCELLED'].includes(o.status))
    .forEach((o) => pushOrder(o, 'mine'))
  myOrders.value
    .filter((o) => ['COMPLETED', 'CANCELLED'].includes(o.status))
    .forEach((o) => pushOrder(o, 'mine'))

  allOrders.value.forEach((o) => {
    if (myOrders.value.some((m) => m.workOrderId === o.workOrderId)) return
    if (['COMPLETED', 'CANCELLED'].includes(o.status)) return
    pushOrder(o, 'order')
  })

  faults.value
    .filter((f) => f.faultId && ['REGISTERED', 'DIAGNOSED'].includes(f.status))
    .forEach((f) => {
      if (usedFaultIds.has(f.faultId!)) return
      usedFaultIds.add(f.faultId!)
      const plate = vehicles.value.find((v) => v.vin === f.vin)?.licensePlate || f.vin
      options.push({
        key: `fault-${f.faultId}`,
        faultId: f.faultId!,
        group: 'fault',
        label: `${f.faultNo} · ${plate} · ${f.status}（待关联工单也可诊断）`,
      })
    })

  return options
})

const mineOptions = computed(() => diagnoseOptions.value.filter((o) => o.group === 'mine'))
const otherOrderOptions = computed(() => diagnoseOptions.value.filter((o) => o.group === 'order'))
const faultOnlyOptions = computed(() => diagnoseOptions.value.filter((o) => o.group === 'fault'))

function applyRouteSelection() {
  const faultId = Number(route.query.faultId)
  if (faultId && faults.value.some((f) => f.faultId === faultId)) {
    selectedFaultId.value = faultId
    return
  }
  const workOrderId = Number(route.query.workOrderId)
  if (workOrderId) {
    const order = [...myOrders.value, ...allOrders.value].find((o) => o.workOrderId === workOrderId)
    if (order?.faultId) selectedFaultId.value = order.faultId
  }
}

watch(selectedFaultId, () => {
  result.value = null
  conversationId.value = null
  chatMessages.value = []
})

async function startDiagnosis() {
  if (!selectedFault.value?.faultId) {
    ElMessage.warning('请先选择工单或故障记录')
    return
  }
  const faultDesc = buildAgentInputFromFault(selectedFault.value.faultDescription)
  loading.value = true
  result.value = null
  customerScript.value = null
  repairQuote.value = null
  try {
    const diag: any = await agentApi.diagnose({
      faultId: selectedFault.value.faultId,
      vin: selectedFault.value.vin,
      faultDesc,
    })
    result.value = {
      suggestion: diag?.diagnosisSuggestion || '暂无建议',
      risks: [`风险等级：${diag?.riskLevel || 'LOW'}`],
      recommendedTests: String(diag?.recommendedChecks || '全车故障码扫描').split(';').filter(Boolean),
      riskLevel: diag?.riskLevel || 'LOW',
      faultId: diag?.faultId,
      diagnosisId: diag?.diagnosisId,
    }
    ElMessage.success('Agent 诊断完成')
  } catch (e: any) {
    ElMessage.error(e?.message || '诊断失败')
  } finally {
    loading.value = false
  }
}

async function handleGenerateScript() {
  if (!result.value?.diagnosisId) {
    ElMessage.warning('请先完成诊断')
    return
  }
  scriptLoading.value = true
  customerScript.value = null
  try {
    const script = await agentApi.generateScript({ diagnosisId: result.value.diagnosisId })
    // 解析JSON并提取中文内容
    try {
      const parsed = JSON.parse(script)
      customerScript.value = {
        explanation: parsed.explanation || '',
        suggestion: parsed.suggestion || '',
        notes: parsed.notes || ''
      }
    } catch {
      customerScript.value = { explanation: script, suggestion: '', notes: '' }
    }
    ElMessage.success('话术生成完成')
  } catch (e: any) {
    ElMessage.error(e?.message || '话术生成失败')
  } finally {
    scriptLoading.value = false
  }
}

async function handleGenerateQuote() {
  if (!result.value?.diagnosisId) {
    ElMessage.warning('请先完成诊断')
    return
  }
  quoteLoading.value = true
  repairQuote.value = null
  try {
    const quote = await agentApi.generateQuote({ diagnosisId: result.value.diagnosisId })
    // 解析JSON并提取中文内容
    try {
      const parsed = JSON.parse(quote)
      repairQuote.value = {
        items: parsed.items || [],
        laborEstimate: parsed.laborEstimate || 0,
        totalMin: parsed.totalMin || 0,
        totalMax: parsed.totalMax || 0,
        notes: parsed.notes || ''
      }
    } catch {
      repairQuote.value = { items: [], laborEstimate: 0, totalMin: 0, totalMax: 0, notes: quote }
    }
    ElMessage.success('报价估算完成')
  } catch (e: any) {
    ElMessage.error(e?.message || '报价估算失败')
  } finally {
    quoteLoading.value = false
  }
}

function goWorkOrders() {
  router.push('/work-order')
}

const chatMessages = ref<Array<{ role: string; content: string; images?: string[] }>>([])
const chatInput = ref('')
const chatLoading = ref(false)
const conversationId = ref<number | null>(null)
const chatContainer = ref<HTMLElement | null>(null)
const uploadedImages = ref<string[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)

const quickQuestions = computed(() => {
  const questions = [
    '这个故障的常见原因是什么？',
    '需要更换哪些配件？',
    '维修大概需要多长时间？',
    '这是保修范围内吗？',
    '有没有类似的历史故障案例？',
  ]
  if (battery.value) {
    questions.unshift('当前电池健康状态如何？')
  }
  return questions
})

function handleQuickQuestion(question: string) {
  chatInput.value = question
  sendChat()
}

function triggerFileUpload() {
  fileInputRef.value?.click()
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files) return

  for (const file of Array.from(files)) {
    if (!file.type.startsWith('image/')) {
      ElMessage.warning('仅支持上传图片文件')
      continue
    }
    if (file.size > 5 * 1024 * 1024) {
      ElMessage.warning('图片大小不能超过5MB')
      continue
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const base64 = e.target?.result as string
      uploadedImages.value.push(base64)
    }
    reader.readAsDataURL(file)
  }
  target.value = ''
}

function removeImage(index: number) {
  uploadedImages.value.splice(index, 1)
}

async function sendChat() {
  const hasText = chatInput.value.trim()
  const hasImages = uploadedImages.value.length > 0
  if ((!hasText && !hasImages) || !selectedFault.value?.faultId) return

  const userMessage = hasText ? chatInput.value.trim() : (hasImages ? '请分析这张图片' : '')
  const images = [...uploadedImages.value]

  chatMessages.value.push({ role: 'user', content: userMessage, images: images.length ? images : undefined })
  chatInput.value = ''
  uploadedImages.value = []
  chatLoading.value = true

  await nextTick()
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }

  try {
    const res: any = await agentApi.chat({
      conversationId: conversationId.value || undefined,
      faultId: selectedFault.value.faultId,
      message: userMessage,
    })
    conversationId.value = res.conversationId
    chatMessages.value.push({ role: 'assistant', content: res.reply })

    await nextTick()
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  } catch (e: any) {
    chatMessages.value.push({ role: 'assistant', content: '抱歉，请求失败，请稍后重试。' })
  } finally {
    chatLoading.value = false
  }
}

onMounted(async () => {
  const [vs, bs, fs, mine, all] = await Promise.all([
    vehicleApi.list(buildVehicleListParams(userStore.role, userStore.userId)),
    batteryApi.list(),
    faultApi.list(),
    workOrderApi.listMine(userStore.userId).catch(() => [] as WorkOrder[]),
    workOrderApi.list().catch(() => [] as WorkOrder[]),
  ])
  vehicles.value = vs || []
  batteries.value = bs || []
  faults.value = fs || []
  myOrders.value = mine || []
  allOrders.value = all || []
  applyRouteSelection()
  if (!selectedFaultId.value && diagnoseOptions.value.length) {
    selectedFaultId.value = diagnoseOptions.value[0].faultId
  }
  if (selectedFaultId.value && route.query.auto === '1') {
    await startDiagnosis()
  }
})
</script>

<template>
  <div class="page-container">
    <PageHeader title="智能诊断" subtitle="结合车主描述与顾问判断，辅助技师排查故障">
      <template #actions>
        <el-button @click="goWorkOrders">去工单列表</el-button>
      </template>
    </PageHeader>

    <el-alert
      v-if="!diagnoseOptions.length"
      type="warning"
      :closable="false"
      show-icon
      title="暂无可诊断数据"
      style="margin-bottom: 16px"
    >
      <p>
        当前账号下没有关联故障的工单，也没有待诊断故障。请先用顾问账号登记故障并生成/派工，
        或执行数据库种子脚本 <code>seed-production.sql</code> 导入演示工单后，用 <code>tech001</code> 登录再试。
      </p>
    </el-alert>

    <el-row :gutter="16">
      <el-col :span="10">
        <div class="page-card input-panel">
          <h3>诊断输入</h3>
          <el-form label-position="top">
            <el-form-item label="关联工单 / 故障">
              <el-select
                v-model="selectedFaultId"
                placeholder="选择工单或故障记录"
                style="width: 100%"
                filterable
              >
                <el-option-group v-if="mineOptions.length" label="我的工单">
                  <el-option
                    v-for="item in mineOptions"
                    :key="item.key"
                    :label="item.label"
                    :value="item.faultId"
                  />
                </el-option-group>
                <el-option-group v-if="otherOrderOptions.length" label="其他在修工单">
                  <el-option
                    v-for="item in otherOrderOptions"
                    :key="item.key"
                    :label="item.label"
                    :value="item.faultId"
                  />
                </el-option-group>
                <el-option-group v-if="faultOnlyOptions.length" label="待诊断故障（可无工单）">
                  <el-option
                    v-for="item in faultOnlyOptions"
                    :key="item.key"
                    :label="item.label"
                    :value="item.faultId"
                  />
                </el-option-group>
              </el-select>
            </el-form-item>

            <template v-if="selectedFault">
              <div class="desc-block owner">
                <h4>车主描述</h4>
                <p>{{ parsedFault.ownerDescription || '（无单独记录，见下方原文）' }}</p>
              </div>
              <div class="desc-block advisor">
                <h4>顾问判断</h4>
                <p>{{ parsedFault.advisorJudgment || '（顾问未单独填写判断）' }}</p>
              </div>
              <div v-if="parsedFault.faultType" class="desc-meta">
                故障现象归类：<strong>{{ parsedFault.faultType }}</strong>
              </div>
            </template>

            <el-button
              v-if="can('agent', 'create')"
              type="primary"
              :loading="loading"
              :disabled="!selectedFaultId"
              style="width: 100%; margin-top: 12px"
              @click="startDiagnosis"
            >
              <el-icon><Cpu /></el-icon>
              开始智能诊断
            </el-button>
          </el-form>

          <el-divider />

          <div v-if="vehicle" class="context-info">
            <h4>车辆信息</h4>
            <p>车型：{{ vehicle.model }} | 里程：{{ vehicle.currentMileage }} km</p>
            <p>电池：{{ vehicle.batteryModel }}</p>
            <template v-if="battery">
              <h4 style="margin-top: 12px">最新电池检测</h4>
              <p>SOH {{ battery.soh }}% | 充电 {{ battery.chargeCycles }} 次</p>
              <p>最高温 {{ battery.maxTemperature }}°C | 压差 {{ battery.voltageDiff }} V</p>
            </template>
          </div>
        </div>
      </el-col>

      <el-col :span="14">
        <div class="page-card result-panel">
          <h3>
            <el-icon color="#e60012"><MagicStick /></el-icon>
            诊断结果
          </h3>

          <div v-if="loading" class="loading-area">
            <el-skeleton :rows="6" animated />
            <p class="streaming">Agent 正在结合车主描述、顾问判断与电池数据进行分析...</p>
          </div>

          <template v-else-if="result">
            <el-alert type="info" :closable="false" show-icon title="初步诊断建议" style="margin-bottom: 16px">
              <p>{{ result.suggestion }}</p>
            </el-alert>

            <div class="section">
              <h4><el-icon color="#ff4d4f"><Warning /></el-icon> 风险提示 ({{ result.riskLevel }})</h4>
              <ul>
                <li v-for="(r, i) in result.risks" :key="i">{{ r }}</li>
              </ul>
            </div>

            <div class="section">
              <h4><el-icon color="#00a651"><List /></el-icon> 推荐检测项目</h4>
              <el-tag v-for="(t, i) in result.recommendedTests" :key="i" style="margin: 4px" type="success" effect="plain">
                {{ t }}
              </el-tag>
            </div>

            <el-divider />

            <div class="section">
              <h4><el-icon color="#1890ff"><Service /></el-icon> AI 辅助工具</h4>
              <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px">
                <el-button
                  type="warning"
                  plain
                  :loading="scriptLoading"
                  @click="handleGenerateScript"
                >
                  <el-icon><ChatDotRound /></el-icon>
                  生成客户沟通话术
                </el-button>
                <el-button
                  type="success"
                  plain
                  :loading="quoteLoading"
                  @click="handleGenerateQuote"
                >
                  <el-icon><Money /></el-icon>
                  生成维修报价估算
                </el-button>
              </div>

              <div v-if="customerScript" class="assistant-result script-result">
                <h5>客户沟通话术</h5>
                <div v-if="customerScript.explanation">
                  <strong>故障解释：</strong>
                  <p>{{ customerScript.explanation }}</p>
                </div>
                <div v-if="customerScript.suggestion">
                  <strong>维修建议：</strong>
                  <p>{{ customerScript.suggestion }}</p>
                </div>
                <div v-if="customerScript.notes">
                  <strong>注意事项：</strong>
                  <p>{{ customerScript.notes }}</p>
                </div>
              </div>

              <div v-if="repairQuote" class="assistant-result quote-result">
                <h5>维修报价估算</h5>
                <div v-if="repairQuote.items && repairQuote.items.length">
                  <strong>费用明细：</strong>
                  <ul style="margin: 8px 0; padding-left: 20px;">
                    <li v-for="(item, idx) in repairQuote.items" :key="idx">
                      {{ item.name }} - {{ item.type }}：{{ item.estimatedPrice }}元
                    </li>
                  </ul>
                </div>
                <div v-if="repairQuote.laborEstimate">
                  <strong>工时费估算：</strong>{{ repairQuote.laborEstimate }}元
                </div>
                <div v-if="repairQuote.totalMin && repairQuote.totalMax">
                  <strong>总价区间：</strong>{{ repairQuote.totalMin }}元 - {{ repairQuote.totalMax }}元
                </div>
                <div v-if="repairQuote.notes">
                  <strong>报价说明：</strong>
                  <p>{{ repairQuote.notes }}</p>
                </div>
              </div>
            </div>
          </template>

          <el-empty v-else description="选择工单或故障后查看车主/顾问描述，再开始诊断" />
        </div>

        <div v-if="selectedFaultId" class="page-card chat-panel" style="margin-top: 16px">
          <h3>
            <el-icon color="#1890ff"><ChatDotRound /></el-icon>
            AI 对话
          </h3>

          <div v-if="!chatMessages.length" class="quick-questions">
            <p class="quick-label">快捷询问</p>
            <div class="quick-tags">
              <el-tag
                v-for="(q, i) in quickQuestions"
                :key="i"
                class="quick-tag"
                effect="plain"
                @click="handleQuickQuestion(q)"
              >
                {{ q }}
              </el-tag>
            </div>
          </div>

          <div ref="chatContainer" class="chat-messages">
            <div v-if="!chatMessages.length" class="chat-empty">
              <p>发送消息与 Agent 进行多轮对话，可针对当前故障继续追问。</p>
            </div>
            <div
              v-for="(msg, i) in chatMessages"
              :key="i"
              :class="['chat-msg', msg.role === 'user' ? 'chat-user' : 'chat-bot']"
            >
              <div v-if="msg.images?.length" class="chat-images">
                <img v-for="(img, j) in msg.images" :key="j" :src="img" class="chat-image" />
              </div>
              <div class="chat-bubble">{{ msg.content }}</div>
            </div>
            <div v-if="chatLoading" class="chat-msg chat-bot">
              <div class="chat-bubble typing">Agent 正在思考...</div>
            </div>
          </div>

          <div v-if="uploadedImages.length" class="upload-preview">
            <div v-for="(img, i) in uploadedImages" :key="i" class="preview-item">
              <img :src="img" class="preview-img" />
              <el-icon class="preview-remove" @click="removeImage(i)"><Close /></el-icon>
            </div>
          </div>

          <div class="chat-input-row">
            <input
              ref="fileInputRef"
              type="file"
              accept="image/*"
              multiple
              style="display: none"
              @change="handleFileSelect"
            />
            <el-button class="upload-btn" @click="triggerFileUpload" :disabled="chatLoading">
              <el-icon><Picture /></el-icon>
            </el-button>
            <el-input
              v-model="chatInput"
              placeholder="输入消息..."
              :disabled="chatLoading"
              @keyup.enter="sendChat"
            />
            <el-button type="primary" :loading="chatLoading" :disabled="!chatInput.trim() && !uploadedImages.length" @click="sendChat">
              发送
            </el-button>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped lang="scss">
.input-panel h3,
.result-panel h3 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.desc-block {
  padding: 12px 14px;
  border-radius: 10px;
  margin-bottom: 10px;
  font-size: 13px;
  line-height: 1.6;

  h4 {
    margin: 0 0 6px;
    font-size: 13px;
    font-weight: 600;
  }

  p {
    margin: 0;
    color: #595959;
    white-space: pre-wrap;
  }

  &.owner {
    background: #f6ffed;
    border: 1px solid #d9f7be;
    h4 { color: #389e0d; }
  }

  &.advisor {
    background: #fff7e6;
    border: 1px solid #ffe7ba;
    h4 { color: #d48806; }
  }
}

.desc-meta {
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 4px;
}

.context-info {
  font-size: 13px;
  color: #595959;

  h4 {
    font-size: 13px;
    color: #1f1f1f;
    margin-bottom: 4px;
  }

  p {
    margin-bottom: 4px;
  }
}

.section {
  margin-bottom: 16px;

  h4 {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    margin-bottom: 8px;
  }

  ul {
    padding-left: 20px;
    color: #595959;
    font-size: 14px;
    line-height: 1.8;
  }
}

.streaming {
  margin-top: 12px;
  color: #e60012;
  font-size: 14px;
  line-height: 1.6;
}

.chat-panel h3 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.chat-messages {
  height: 320px;
  overflow-y: auto;
  padding: 12px;
  background: #fafafa;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
  margin-bottom: 12px;
}

.chat-empty {
  text-align: center;
  color: #8c8c8c;
  font-size: 13px;
  padding-top: 80px;

  p { margin: 0; }
}

.chat-msg {
  margin-bottom: 12px;
  display: flex;

  &.chat-user {
    justify-content: flex-end;
    .chat-bubble {
      background: #1890ff;
      color: #fff;
      border-radius: 12px 12px 2px 12px;
    }
  }

  &.chat-bot {
    justify-content: flex-start;
    .chat-bubble {
      background: #fff;
      color: #262626;
      border: 1px solid #e8e8e8;
      border-radius: 12px 12px 12px 2px;
    }
  }
}

.chat-bubble {
  max-width: 80%;
  padding: 10px 14px;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;

  &.typing {
    color: #8c8c8c;
    font-style: italic;
  }
}

.chat-input-row {
  display: flex;
  gap: 8px;
  align-items: center;

  .el-input { flex: 1; }

  .upload-btn {
    padding: 8px 10px;
    border-color: #d9d9d9;
    &:hover { border-color: #1890ff; color: #1890ff; }
  }
}

.quick-questions {
  margin-bottom: 12px;

  .quick-label {
    font-size: 12px;
    color: #8c8c8c;
    margin-bottom: 8px;
  }

  .quick-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .quick-tag {
    cursor: pointer;
    border-radius: 16px;
    font-size: 12px;
    user-select: none;
    transition: all 0.2s;

    &:hover {
      color: #1890ff;
      border-color: #1890ff;
      background: #e6f7ff;
    }
  }
}

.upload-preview {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
  padding: 8px;
  background: #fafafa;
  border-radius: 8px;

  .preview-item {
    position: relative;
    width: 64px;
    height: 64px;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid #e8e8e8;
  }

  .preview-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .preview-remove {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 16px;
    height: 16px;
    background: rgba(0,0,0,0.5);
    color: #fff;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;

    &:hover { background: rgba(0,0,0,0.7); }
  }
}

.chat-images {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 6px;

  .chat-image {
    max-width: 200px;
    max-height: 150px;
    border-radius: 8px;
    object-fit: cover;
    cursor: pointer;
  }
}

.assistant-result {
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.6;

  h5 {
    margin: 0 0 8px;
    font-size: 13px;
    font-weight: 600;
  }

  pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: inherit;
  }

  &.script-result {
    background: #fff7e6;
    border: 1px solid #ffe7ba;

    h5 { color: #d48806; }
  }

  &.quote-result {
    background: #f6ffed;
    border: 1px solid #d9f7be;

    h5 { color: #389e0d; }
  }
}
</style>
